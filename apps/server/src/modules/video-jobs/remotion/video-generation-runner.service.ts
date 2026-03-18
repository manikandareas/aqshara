import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import type { VideoWorkerDispatchPayload } from '../video-job.schemas';
import { VideoJobsRepository } from '../video-jobs.repository';
import { VideoJobsService } from '../video-jobs.service';
import { VideoCreativeService } from './video-creative.service';
import { RemotionRenderService } from './remotion-render.service';
import {
  isVideoRenderTerminalError,
  normalizeVideoRenderError,
} from './video-render.errors';
import { VideoMediaProbeService } from './video-media-probe.service';
import { VideoNarrationService } from './video-narration.service';
import type {
  BuiltVideoNarrative,
  BuiltVideoScene,
  VideoRenderProps,
} from './video-renderer.types';

@Injectable()
export class VideoGenerationRunnerService {
  private readonly workerId: string;
  private readonly persistDebugArtifacts: boolean;
  private readonly narrationConcurrency: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly videoJobsRepository: VideoJobsRepository,
    private readonly videoJobsService: VideoJobsService,
    private readonly videoCreativeService: VideoCreativeService,
    private readonly videoNarrationService: VideoNarrationService,
    private readonly videoMediaProbeService: VideoMediaProbeService,
    private readonly remotionRenderService: RemotionRenderService,
  ) {
    this.workerId =
      this.configService.get<string>('VIDEO_WORKER_ID') ?? 'video-worker-native';
    this.persistDebugArtifacts = this.configService.get<boolean>(
      'VIDEO_PERSIST_DEBUG_ARTIFACTS',
      false,
    );
    this.narrationConcurrency = Math.max(
      1,
      this.configService.get<number>('VIDEO_TTS_CONCURRENCY', 2),
    );
  }

  async run(job: VideoWorkerDispatchPayload): Promise<void> {
    const current = await this.videoJobsRepository.findVideoJobById(
      job.video_job_id,
    );

    if (!current) {
      return;
    }

    await this.videoJobsRepository.markVideoJobAccepted({
      jobId: current.id,
      attempt: current.current_attempt,
      workerId: this.workerId,
      leaseExpiresAt: this.nextLeaseExpiry(),
    });

    const heartbeat = setInterval(() => {
      void this.videoJobsRepository.touchVideoJobHeartbeat({
        jobId: current.id,
        attempt: current.current_attempt,
        workerId: this.workerId,
        leaseExpiresAt: this.nextLeaseExpiry(),
      });
    }, 10_000);

    try {
      await this.videoJobsService.applyInternalProgress(job.video_job_id, {
        pipeline_stage: 'preprocessing',
        progress_pct: 5,
        message: 'Loading OCR artifact',
      });

      const ocrResult = await this.storageService.downloadJson(
        this.storageService.createDocumentOcrArtifactKey(job.document_id),
      );

      const creativeResult = await this.videoCreativeService.planNarrative({
        ocrResult,
        targetDurationSec: current.target_duration_sec,
        targetLanguage: job.language,
      });
      this.validateStoryboard(creativeResult.narrative);
      const artifactKeys = await this.persistNarrativeArtifacts(
        job.video_job_id,
        creativeResult.narrative,
        creativeResult.creativePlanArtifact,
      );

      await this.videoJobsService.applyInternalProgress(job.video_job_id, {
        pipeline_stage: 'storyboarding',
        progress_pct: 25,
        message: creativeResult.fallbackApplied
          ? 'AI creative planning failed, using deterministic fallback'
          : 'AI creative plan built for Remotion composition',
        fallback_applied: creativeResult.fallbackApplied,
        fallback_reason: creativeResult.fallbackReason,
        quality_gate: {
          storyboard_valid: true,
          audio_ready: false,
          render_valid: false,
        },
      });

      const scenes = await this.attachNarration(
        job,
        creativeResult.narrative.scenes,
      );
      this.validateRenderPrep(scenes);

      await this.videoJobsService.applyInternalProgress(job.video_job_id, {
        pipeline_stage: 'tts_generating',
        progress_pct: 45,
        message: 'Narration audio generated',
        quality_gate: {
          storyboard_valid: true,
          audio_ready: true,
          render_valid: false,
        },
      });

      const workspace = await mkdtemp(join(tmpdir(), 'aqshara-video-render-'));
      const outputLocation = join(workspace, `${job.video_job_id}.mp4`);

      try {
        const props = this.toRenderProps(
          job.video_job_id,
          creativeResult.narrative.topic,
          (current.render_profile as '480p' | '720p') ?? '720p',
          scenes,
        );
        this.validateRenderProps(props);

        let lastReportedRenderProgress = 0;

        await this.remotionRenderService.renderVideo({
          props,
          outputLocation,
          onProgress: async (progress) => {
            const normalizedProgress = Math.max(0, Math.min(1, progress));
            const reportPct = Math.round(normalizedProgress * 100);

            if (reportPct < 100 && reportPct - lastReportedRenderProgress < 5) {
              return;
            }

            lastReportedRenderProgress = reportPct;
            await this.videoJobsService.applyInternalProgress(job.video_job_id, {
              pipeline_stage: 'rendering',
              progress_pct: 45 + Math.round(normalizedProgress * 45),
              message: 'Rendering Remotion composition',
              quality_gate: {
                storyboard_valid: true,
                audio_ready: true,
                render_valid: normalizedProgress >= 1,
              },
            });
          },
        });

        const finalVideoObjectKey = this.storageService.createVideoFinalKey(
          job.video_job_id,
        );
        await this.storageService.uploadFile(
          finalVideoObjectKey,
          outputLocation,
          'video/mp4',
        );
        artifactKeys.push(finalVideoObjectKey);

        const durationSec =
          await this.videoMediaProbeService.getVideoDurationSec(outputLocation);

        await this.videoJobsService.applyInternalProgress(job.video_job_id, {
          pipeline_stage: 'uploading',
          progress_pct: 95,
          message: 'Uploading final video',
          quality_gate: {
            storyboard_valid: true,
            audio_ready: true,
            render_valid: true,
          },
        });

        await this.videoJobsService.applyInternalComplete(job.video_job_id, {
          final_video_object_key: finalVideoObjectKey,
          final_thumbnail_object_key: null,
          duration_sec: durationSec,
          resolution:
            current.render_profile === '480p' ? '854x480' : '1280x720',
          artifact_keys: artifactKeys,
        });
      } finally {
        await this.remotionRenderService.cleanupJobAssets(job.video_job_id);
        await rm(workspace, { recursive: true, force: true });
      }
    } catch (error) {
      const normalizedError = normalizeVideoRenderError(error);
      await this.videoJobsService.applyInternalFail(job.video_job_id, {
        pipeline_stage: 'failed',
        error_code: 'VIDEO_RENDER_FAILED',
        error_message: normalizedError.message,
        is_retryable: !isVideoRenderTerminalError(normalizedError),
      });
      throw normalizedError;
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async persistNarrativeArtifacts(
    videoJobId: string,
    narrative: BuiltVideoNarrative,
    creativePlanArtifact: Record<string, unknown>,
  ) {
    const summaryKey = this.storageService.createVideoArtifactKey(
      videoJobId,
      'summary.json',
    );
    const storyboardKey = this.storageService.createVideoArtifactKey(
      videoJobId,
      'storyboard.json',
    );
    const scenesKey = this.storageService.createVideoArtifactKey(
      videoJobId,
      'scenes.md',
    );
    const creativePlanKey = this.storageService.createVideoArtifactKey(
      videoJobId,
      'creative-plan.json',
    );

    await this.storageService.uploadText(
      storyboardKey,
      JSON.stringify(narrative.storyboard, null, 2),
      'application/json',
    );
    await this.storageService.uploadText(
      creativePlanKey,
      JSON.stringify(creativePlanArtifact, null, 2),
      'application/json',
    );

    const artifactKeys = [storyboardKey, creativePlanKey];

    if (this.persistDebugArtifacts) {
      await this.storageService.uploadText(
        summaryKey,
        JSON.stringify(narrative.summary, null, 2),
        'application/json',
      );
      await this.storageService.uploadText(
        scenesKey,
        narrative.scenesMarkdown,
        'text/markdown',
      );
      artifactKeys.push(summaryKey, scenesKey);
    }

    return artifactKeys;
  }

  private async attachNarration(
    job: VideoWorkerDispatchPayload,
    scenes: BuiltVideoScene[],
  ) {
    const updatedScenes = new Array<BuiltVideoScene>(scenes.length);
    let nextIndex = 0;

    await Promise.all(
      Array.from({ length: Math.min(this.narrationConcurrency, scenes.length) }, async () => {
        while (true) {
          const currentIndex = nextIndex++;
          if (currentIndex >= scenes.length) {
            return;
          }

          const scene = scenes[currentIndex]!;
          const narration = await this.videoNarrationService.synthesize({
            text: scene.narrationText,
            voice: job.voice,
          });
          const fileName = `scene-${scene.sceneIndex.toString().padStart(2, '0')}.${narration.fileExtension}`;
          const audioObjectKey = this.storageService.createVideoArtifactKey(
            job.video_job_id,
            `audio/${fileName}`,
          );

          await this.storageService.uploadObject(
            audioObjectKey,
            narration.audioBytes,
            narration.contentType,
          );
          const audioStaticFilePath =
            await this.remotionRenderService.stageAudioAsset({
              videoJobId: job.video_job_id,
              fileName,
              content: narration.audioBytes,
            });

          updatedScenes[currentIndex] = {
            ...scene,
            audioStaticFilePath,
            audioObjectKey,
            actualAudioDurationMs: narration.durationMs,
            durationInFrames: Math.max(
              60,
              Math.round((narration.durationMs / 1000) * 30),
            ),
          };

          await this.videoJobsRepository.upsertScene(job.video_job_id, {
            sceneIndex: scene.sceneIndex,
            templateType: scene.templateType,
            status: 'done',
            plannedDurationMs: Math.round((scene.durationInFrames / 30) * 1000),
            actualAudioDurationMs: narration.durationMs,
            audioObjectKey,
          });
        }
      }),
    );

    return updatedScenes;
  }

  private toRenderProps(
    videoJobId: string,
    topic: string,
    renderProfile: '480p' | '720p',
    scenes: BuiltVideoScene[],
  ): VideoRenderProps {
    return {
      videoJobId,
      topic,
      renderProfile,
      scenes: scenes.map((scene) => ({
        sceneIndex: scene.sceneIndex,
        templateType: scene.templateType,
        title: scene.title,
        body: scene.body,
        bullets: scene.bullets,
        accentColor: scene.accentColor,
        durationInFrames: scene.durationInFrames,
        audioStaticFilePath: scene.audioStaticFilePath,
        transition: scene.transition,
      })),
    };
  }

  private nextLeaseExpiry() {
    return new Date(
      Date.now() +
        this.configService.get<number>('VIDEO_WORKER_LEASE_TTL_MS', 45_000),
    );
  }

  private validateStoryboard(narrative: BuiltVideoNarrative) {
    if (narrative.scenes.length !== 5) {
      throw new Error('Storyboard must contain exactly 5 scenes');
    }

    let totalDurationInFrames = 0;

    for (const scene of narrative.scenes) {
      if (
        !scene.title.trim() ||
        !scene.body.trim() ||
        !scene.narrationText.trim()
      ) {
        throw new Error(`Storyboard scene ${scene.sceneIndex} is incomplete`);
      }

      if (scene.title.length > 120 || scene.body.length > 300) {
        throw new Error(`Storyboard scene ${scene.sceneIndex} exceeds text limits`);
      }

      totalDurationInFrames += scene.durationInFrames;
    }

    if (totalDurationInFrames < 150) {
      throw new Error('Storyboard duration is too short to render');
    }
  }

  private validateRenderPrep(scenes: BuiltVideoScene[]) {
    for (const scene of scenes) {
      if (!scene.audioStaticFilePath || !scene.audioObjectKey) {
        throw new Error(`Scene ${scene.sceneIndex} is missing narration audio`);
      }

      if (!scene.actualAudioDurationMs || scene.actualAudioDurationMs <= 0) {
        throw new Error(`Scene ${scene.sceneIndex} has invalid audio duration`);
      }
    }
  }

  private validateRenderProps(props: VideoRenderProps) {
    if (props.scenes.length === 0) {
      throw new Error('Render props must include at least one scene');
    }

    for (const scene of props.scenes) {
      if (!scene.audioStaticFilePath) {
        throw new Error(`Render props scene ${scene.sceneIndex} is missing audio`);
      }
    }
  }
}
