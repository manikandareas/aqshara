import crypto from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { from, interval, map, Observable, startWith, switchMap } from 'rxjs';
import { MetricsService } from '../../observability/metrics.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { BunnyStreamService } from '../../infrastructure/video-delivery/bunny-stream.service';
import { DocumentsService } from '../documents/documents.service';
import type {
  CreateVideoJobRequestDto,
  InternalVideoCompleteDto,
  InternalVideoFailDto,
  InternalVideoProgressDto,
} from './dto';
import {
  VIDEO_ACTIVE_JOB_STATUSES,
  VIDEO_DEFAULT_LANGUAGE,
  VIDEO_DEFAULT_QUALITY_GATE,
  VIDEO_DEFAULT_RENDER_PROFILE,
  VIDEO_DEFAULT_TARGET_DURATION_SEC,
  VIDEO_DEFAULT_VOICE,
  VIDEO_PIPELINE_STAGE_INDEX,
  VIDEO_PROGRESS_STAGE_ORDER,
  VIDEO_STATUS_STREAM_EVENT,
  VIDEO_STATUS_STREAM_POLL_MS,
  type VideoPipelineStage,
  type VideoQualityGate,
  type VideoRenderProfile,
} from './video-jobs.constants';
import {
  VideoJobsRepository,
  type VideoJobRecord,
} from './video-jobs.repository';
import {
  VIDEO_COMMAND_TOPIC,
  type VideoGenerateCommand,
  type VideoTransportEvent,
  type VideoTransportEventType,
} from './video-transport.schemas';

@Injectable()
export class VideoJobsService {
  private readonly callbackIdempotencyKeys = new Map<string, number>();
  private readonly videoNotFoundMessage = 'Video job not found';
  private readonly logger = new Logger(VideoJobsService.name);

  constructor(
    private readonly videoJobsRepository: VideoJobsRepository,
    private readonly documentsService: DocumentsService,
    private readonly storageService: StorageService,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  async createVideoJob(
    input: CreateVideoJobRequestDto & {
      ownerId: string;
      requestId?: string;
    },
  ) {
    await this.documentsService.assertOwnedDocumentReady(
      input.document_id,
      input.ownerId,
    );

    const existing =
      await this.videoJobsRepository.findLatestActiveOwnedJobByDocumentId(
        input.document_id,
        input.ownerId,
      );

    if (existing) {
      return { data: this.toVideoJobItem(existing) };
    }

    const completed =
      await this.videoJobsRepository.findLatestCompletedOwnedJobByDocumentId(
        input.document_id,
        input.ownerId,
      );

    if (completed) {
      throw new ConflictException('Video already generated for document');
    }

    const created = await this.videoJobsRepository.createVideoJob({
      documentId: input.document_id,
      ownerId: input.ownerId,
      targetDurationSec:
        input.target_duration_sec ?? VIDEO_DEFAULT_TARGET_DURATION_SEC,
      voice: input.voice ?? VIDEO_DEFAULT_VOICE,
      language: input.language ?? VIDEO_DEFAULT_LANGUAGE,
    });

    await this.enqueueJob(created, input.requestId, 0);

    return { data: this.toVideoJobItem(created) };
  }

  async ensureAutoVideoJobForReadyDocument(input: {
    documentId: string;
    ownerId: string;
    requestId?: string;
  }) {
    const existing =
      await this.videoJobsRepository.findLatestActiveOwnedJobByDocumentId(
        input.documentId,
        input.ownerId,
      );

    if (existing) {
      return existing;
    }

    const document = await this.documentsService.assertOwnedDocumentReady(
      input.documentId,
      input.ownerId,
    );

    if (!document.require_video_generation) {
      return null;
    }

    const created = await this.videoJobsRepository.createVideoJob({
      documentId: input.documentId,
      ownerId: input.ownerId,
      targetDurationSec: VIDEO_DEFAULT_TARGET_DURATION_SEC,
      voice: VIDEO_DEFAULT_VOICE,
      language: VIDEO_DEFAULT_LANGUAGE,
    });

    await this.enqueueJob(created, input.requestId, 0);
    return created;
  }

  async getVideoJob(jobId: string, ownerId: string) {
    const job = await this.findOwnedJobOrThrow(jobId, ownerId);
    const refreshed = await this.syncStreamDeliveryState(job);
    return { data: this.toVideoJobItem(refreshed) };
  }

  async getVideoJobStatus(jobId: string, ownerId: string) {
    const job = await this.findOwnedJobOrThrow(jobId, ownerId);
    const refreshed = await this.syncStreamDeliveryState(job);
    const sceneCounts = await this.videoJobsRepository.getSceneCounts(jobId);

    return {
      data: {
        video_job_id: refreshed.id,
        status: refreshed.status,
        pipeline_stage: refreshed.pipeline_stage,
        progress_pct: refreshed.progress_pct,
        current_scene_index: refreshed.current_scene_index,
        fallback_used_count: refreshed.fallback_used_count,
        render_profile: refreshed.render_profile,
        quality_gate: this.normalizeQualityGate(refreshed.quality_gate),
        stages: this.buildStageSnapshots(
          refreshed.pipeline_stage as VideoPipelineStage,
          refreshed.status,
          refreshed.progress_pct,
        ),
        scenes: sceneCounts,
        error:
          refreshed.error_code && refreshed.error_message
            ? { code: refreshed.error_code, message: refreshed.error_message }
            : null,
      },
    };
  }

  streamVideoJobStatus(
    jobId: string,
    ownerId: string,
  ): Observable<MessageEvent> {
    return interval(VIDEO_STATUS_STREAM_POLL_MS).pipe(
      startWith(0),
      switchMap(() => from(this.getVideoJobStatus(jobId, ownerId))),
      map((payload) => ({
        type: VIDEO_STATUS_STREAM_EVENT,
        data: payload.data,
      })),
    );
  }

  async retryVideoJob(jobId: string, ownerId: string, requestId?: string) {
    const job = await this.findOwnedJobOrThrow(jobId, ownerId);

    if (job.status !== 'failed') {
      throw new ConflictException('Only failed video jobs can be retried');
    }

    await this.documentsService.assertOwnedDocumentReady(
      job.document_id,
      ownerId,
    );
    const updated = await this.resetAndReloadOwnedJob(
      jobId,
      ownerId,
      this.videoNotFoundMessage,
    );

    await this.enqueueJob(updated, requestId, 0);
    return { data: this.toVideoJobItem(updated) };
  }

  async getVideoJobResult(jobId: string, ownerId: string) {
    const job = await this.findOwnedJobOrThrow(jobId, ownerId);
    const refreshed = await this.syncStreamDeliveryState(job);

    if (refreshed.status !== 'completed') {
      throw new ConflictException('Video job not completed');
    }

    const videoUrl = this.buildPlaybackUrl(refreshed);

    if (!videoUrl) {
      throw new ConflictException('Video playback not ready');
    }

    return {
      data: {
        video_job_id: refreshed.id,
        status: refreshed.status,
        video_url: videoUrl,
        embed_url: videoUrl,
        playback_status: this.buildPlaybackStatus(refreshed),
        thumbnail_url: refreshed.final_thumbnail_object_key
          ? this.storageService.createObjectUrl(
              refreshed.final_thumbnail_object_key,
            )
          : null,
        duration_sec: refreshed.duration_sec ?? 0,
        resolution: refreshed.resolution ?? 'unknown',
      },
    };
  }

  async getVideoJobForWorker(jobId: string) {
    return this.videoJobsRepository.findVideoJobById(jobId);
  }

  async ingestTransportEvent(event: VideoTransportEvent): Promise<boolean> {
    const inserted = await this.recordTransportEvent({
      eventId: event.event_id,
      jobId: event.job_id,
      attempt: event.attempt,
      eventType: event.event_type,
      workerId: 'worker_id' in event ? event.worker_id : null,
      payload: event as unknown as Record<string, unknown>,
      occurredAt: event.occurred_at,
    });

    if (!inserted) {
      return false;
    }

    switch (event.event_type) {
      case 'job.accepted':
        await this.applyTransportLeaseEvent(event);
        return true;
      case 'job.heartbeat':
        await this.applyTransportLeaseEvent(event);
        return true;
      case 'job.progress':
      case 'scene.progress':
        await this.applyTransportLeaseEvent(event);
        await this.applyInternalProgress(
          event.job_id,
          event.payload,
          event.event_id,
        );
        return true;
      case 'job.completed':
        await this.applyTransportLeaseEvent(event);
        await this.applyInternalComplete(
          event.job_id,
          event.payload,
          event.event_id,
        );
        return true;
      case 'job.failed':
        await this.applyInternalFail(
          event.job_id,
          event.payload,
          event.event_id,
        );
        await this.maybeAutoRetry(event);
        return true;
    }
  }

  async recoverStalledJobs(): Promise<number> {
    const stalledJobs = await this.videoJobsRepository.findStalledJobs(
      new Date(),
      20,
    );

    for (const job of stalledJobs) {
      if (job.current_attempt < this.maxAttempts()) {
        await this.videoJobsRepository.resetVideoJobForRetry(job.id);
        const refreshed = await this.videoJobsRepository.findVideoJobById(
          job.id,
        );

        if (refreshed) {
          await this.enqueueJob(
            refreshed,
            null,
            this.retryDelayMs(refreshed.retry_count),
          );
        }

        continue;
      }

      await this.videoJobsRepository.failStalledJob(
        job.id,
        'Video worker lease expired before a terminal event was received',
      );
    }

    return stalledJobs.length;
  }

  async applyInternalProgress(
    jobId: string,
    payload: InternalVideoProgressDto,
    idempotencyKey?: string,
  ): Promise<void> {
    if (this.isDuplicateCallback(idempotencyKey)) {
      return;
    }

    const job = await this.findJobOrThrow(jobId);

    if (job.status === 'completed') {
      return;
    }

    this.assertMonotonicStage(
      job.pipeline_stage as VideoPipelineStage,
      payload.pipeline_stage as VideoPipelineStage,
      job.status,
    );

    await this.videoJobsRepository.updateVideoJobProgress({
      jobId,
      status: payload.pipeline_stage === 'queued' ? 'queued' : 'processing',
      pipelineStage: payload.pipeline_stage as VideoPipelineStage,
      progressPct: payload.progress_pct,
      currentSceneIndex: payload.scene?.scene_index ?? null,
      fallbackIncrement: payload.fallback_applied ? 1 : 0,
      renderProfile: payload.render_profile as VideoRenderProfile | undefined,
      qualityGate: payload.quality_gate
        ? this.mergeQualityGate(job.quality_gate, payload.quality_gate)
        : undefined,
    });

    if (payload.scene) {
      await this.videoJobsRepository.upsertScene(jobId, {
        sceneIndex: payload.scene.scene_index,
        templateType: payload.scene.template_type as never,
        status: payload.scene.status as never,
        plannedDurationMs: payload.scene.planned_duration_ms ?? null,
        actualAudioDurationMs: payload.scene.actual_audio_duration_ms ?? null,
        audioObjectKey: payload.scene.audio_object_key ?? null,
        manimCodeObjectKey: payload.scene.manim_code_object_key ?? null,
        videoObjectKey: payload.scene.video_object_key ?? null,
      });
    }

    this.metricsService.recordVideoJobCallback(
      'progress',
      payload.pipeline_stage,
    );
    if (payload.metrics?.elapsed_ms !== undefined) {
      this.metricsService.observeVideoJobStageElapsed(
        payload.pipeline_stage,
        payload.metrics.elapsed_ms,
      );
    }
    if (payload.scene) {
      this.metricsService.recordVideoJobSceneEvent(
        payload.pipeline_stage,
        payload.scene.status,
        payload.scene.template_type ?? 'unknown',
      );
    }
    if (payload.fallback_applied && payload.fallback_reason) {
      this.metricsService.recordVideoJobFallback(
        payload.pipeline_stage,
        payload.fallback_reason,
      );
    }
    this.rememberCallback(idempotencyKey);
  }

  async applyInternalComplete(
    jobId: string,
    payload: InternalVideoCompleteDto,
    idempotencyKey?: string,
  ): Promise<void> {
    if (this.isDuplicateCallback(idempotencyKey)) {
      return;
    }

    const job = await this.findJobOrThrow(jobId);

    if (job.status === 'completed') {
      return;
    }

    if (!this.bunnyStreamService.isConfigured()) {
      await this.videoJobsRepository.markVideoJobCompletedFromStorage({
        jobId,
        finalVideoObjectKey: payload.final_video_object_key,
        finalThumbnailObjectKey: payload.final_thumbnail_object_key ?? null,
        durationSec: payload.duration_sec,
        resolution: payload.resolution,
        terminalEventId: idempotencyKey ?? null,
      });
    } else {
      try {
        const sourceVideo = await this.readStoredVideoAsset(
          payload.final_video_object_key,
        );
        const created = await this.bunnyStreamService.createVideo(
          `Aqshara ${job.id}`,
        );
        await this.bunnyStreamService.uploadVideo(
          created.videoId,
          sourceVideo.bytes,
          sourceVideo.contentType,
        );
        await this.videoJobsRepository.markVideoJobStreamProcessing({
          jobId,
          finalVideoObjectKey: payload.final_video_object_key,
          finalThumbnailObjectKey: payload.final_thumbnail_object_key ?? null,
          durationSec: payload.duration_sec,
          resolution: payload.resolution,
          bunnyLibraryId: created.libraryId,
          bunnyVideoId: created.videoId,
          bunnyStatus: created.status,
          terminalEventId: idempotencyKey ?? null,
        });
      } catch (error) {
        this.logger.error({
          message: 'Failed to publish final video to Bunny Stream',
          video_job_id: jobId,
          error: error instanceof Error ? error.message : String(error),
        });
        await this.videoJobsRepository.markVideoJobFailed({
          jobId,
          pipelineStage: 'stream_processing',
          errorCode: 'BUNNY_STREAM_PUBLISH_FAILED',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Bunny Stream publish failed',
          terminalEventId: idempotencyKey ?? null,
        });
        this.rememberCallback(idempotencyKey);
        return;
      }
    }

    if (payload.artifact_keys?.length) {
      await this.videoJobsRepository.addArtifacts(jobId, payload.artifact_keys);
    }

    this.metricsService.recordVideoJobCallback('complete', 'completed');
    this.rememberCallback(idempotencyKey);
  }

  async applyInternalFail(
    jobId: string,
    payload: InternalVideoFailDto,
    idempotencyKey?: string,
  ): Promise<void> {
    if (this.isDuplicateCallback(idempotencyKey)) {
      return;
    }

    const job = await this.findJobOrThrow(jobId);

    if (job.status === 'completed') {
      return;
    }

    await this.videoJobsRepository.markVideoJobFailed({
      jobId,
      pipelineStage: payload.pipeline_stage as VideoPipelineStage,
      errorCode: payload.error_code,
      errorMessage: payload.error_message,
      failedSceneIndex: payload.failed_scene_index ?? null,
      terminalEventId: idempotencyKey ?? null,
    });

    if (payload.failed_scene_index) {
      await this.videoJobsRepository.upsertScene(jobId, {
        sceneIndex: payload.failed_scene_index,
        status: 'error',
        errorMessage: payload.error_message,
      });
    }

    if (payload.debug_artifact_keys?.length) {
      await this.videoJobsRepository.addArtifacts(
        jobId,
        payload.debug_artifact_keys,
      );
    }

    this.metricsService.recordVideoJobCallback('fail', payload.pipeline_stage);
    this.rememberCallback(idempotencyKey);
  }

  async applyTransportAccepted(input: {
    jobId: string;
    attempt: number;
    workerId: string;
    leaseExpiresAt: Date;
  }): Promise<void> {
    const job = await this.videoJobsRepository.findVideoJobById(input.jobId);

    if (!job || job.current_attempt !== input.attempt) {
      return;
    }

    await this.videoJobsRepository.markVideoJobAccepted(input);
  }

  async applyTransportHeartbeat(input: {
    jobId: string;
    attempt: number;
    workerId: string;
    leaseExpiresAt: Date;
  }): Promise<void> {
    const job = await this.videoJobsRepository.findVideoJobById(input.jobId);

    if (!job || job.current_attempt !== input.attempt) {
      return;
    }

    await this.videoJobsRepository.touchVideoJobHeartbeat(input);
  }

  async recordTransportEvent(input: {
    eventId: string;
    jobId: string;
    attempt: number;
    eventType: VideoTransportEventType;
    workerId?: string | null;
    payload: Record<string, unknown>;
    occurredAt: string;
  }): Promise<boolean> {
    return this.videoJobsRepository.insertVideoTransportEvent(input);
  }

  private async enqueueJob(
    job: VideoJobRecord,
    requestId?: string | null,
    delayMs = 0,
  ): Promise<void> {
    const command: VideoGenerateCommand = {
      schema_version: '2026-03-11',
      command_id: crypto.randomUUID(),
      topic: VIDEO_COMMAND_TOPIC,
      job_id: job.id,
      document_id: job.document_id,
      owner_id: job.owner_id,
      request_id: requestId ?? null,
      attempt: job.current_attempt,
      target_duration_sec: job.target_duration_sec,
      voice: job.voice,
      language: job.language,
      render_profile: job.render_profile ?? VIDEO_DEFAULT_RENDER_PROFILE,
      ocr_object_key: this.storageService.createDocumentOcrArtifactKey(
        job.document_id,
      ),
      output_prefix: `videos/${job.id}`,
      correlation_id: requestId ?? job.id,
      trace_id: requestId ?? null,
      occurred_at: new Date().toISOString(),
    };

    await this.videoJobsRepository.createVideoOutboxCommand(job.id, command, {
      nextAttemptAt: new Date(Date.now() + delayMs),
    });
  }

  private normalizeQualityGate(
    qualityGate: VideoQualityGate | null | undefined,
  ): VideoQualityGate {
    return {
      ...VIDEO_DEFAULT_QUALITY_GATE,
      ...(qualityGate ?? {}),
    };
  }

  private mergeQualityGate(
    current: VideoQualityGate | null | undefined,
    next: Partial<VideoQualityGate>,
  ): VideoQualityGate {
    return {
      ...this.normalizeQualityGate(current),
      ...next,
    };
  }

  private buildStageSnapshots(
    currentStage: VideoPipelineStage,
    status: string,
    progressPct: number,
  ) {
    const currentIndex = VIDEO_PIPELINE_STAGE_INDEX[currentStage] ?? 0;

    return VIDEO_PROGRESS_STAGE_ORDER.filter(
      (stage) =>
        stage !== 'queued' && stage !== 'completed' && stage !== 'failed',
    ).map((stage, index) => {
      if (index < currentIndex - 1) {
        return { name: stage, status: 'completed', progress_pct: 100 };
      }

      if (stage === currentStage) {
        return {
          name: stage,
          status: status === 'failed' ? 'failed' : 'running',
          progress_pct: progressPct,
        };
      }

      return { name: stage, status: 'pending', progress_pct: 0 };
    });
  }

  private async findOwnedJobOrThrow(
    jobId: string,
    ownerId: string,
  ): Promise<VideoJobRecord> {
    const job = await this.videoJobsRepository.findOwnedVideoJobById(
      jobId,
      ownerId,
    );

    if (!job) {
      throw new NotFoundException(this.videoNotFoundMessage);
    }

    return job;
  }

  async syncStreamDeliveryState(job: VideoJobRecord): Promise<VideoJobRecord> {
    if (
      !this.bunnyStreamService.isConfigured() ||
      job.pipeline_stage !== 'stream_processing' ||
      !job.bunny_video_id
    ) {
      return job;
    }

    const streamState = await this.bunnyStreamService.getVideo(job.bunny_video_id);

    if (streamState.status === null) {
      return job;
    }

    if (streamState.status === 5) {
      await this.videoJobsRepository.markVideoJobFailed({
        jobId: job.id,
        pipelineStage: 'stream_processing',
        errorCode: 'BUNNY_STREAM_FAILED',
        errorMessage: 'Bunny Stream failed to process the uploaded video',
      });
    } else if (streamState.status === 3 || streamState.status === 4) {
      await this.videoJobsRepository.markVideoJobCompleted({
        jobId: job.id,
        bunnyStatus: streamState.status,
      });
    } else if (streamState.status !== job.bunny_status) {
      await this.videoJobsRepository.updateBunnyStreamStatus({
        jobId: job.id,
        bunnyStatus: streamState.status,
      });
    }

    const refreshed = await this.videoJobsRepository.findVideoJobById(job.id);
    return refreshed ?? job;
  }

  private async findJobOrThrow(jobId: string): Promise<VideoJobRecord> {
    const job = await this.videoJobsRepository.findVideoJobById(jobId);

    if (!job) {
      throw new NotFoundException(this.videoNotFoundMessage);
    }

    return job;
  }

  private async resetAndReloadOwnedJob(
    jobId: string,
    ownerId: string,
    notFoundMessage: string,
  ): Promise<VideoJobRecord> {
    await this.videoJobsRepository.resetVideoJobForRetry(jobId);

    const refreshed = await this.videoJobsRepository.findOwnedVideoJobById(
      jobId,
      ownerId,
    );

    if (!refreshed) {
      throw new NotFoundException(notFoundMessage);
    }

    return refreshed;
  }

  private async resetAndReloadJob(
    jobId: string,
  ): Promise<VideoJobRecord | null> {
    await this.videoJobsRepository.resetVideoJobForRetry(jobId);
    return this.videoJobsRepository.findVideoJobById(jobId);
  }

  private async applyTransportLeaseEvent(
    event: Extract<
      VideoTransportEvent,
      | { event_type: 'job.accepted' }
      | { event_type: 'job.heartbeat' }
      | { event_type: 'job.progress' }
      | { event_type: 'scene.progress' }
      | { event_type: 'job.completed' }
    >,
  ): Promise<void> {
    const input = {
      jobId: event.job_id,
      attempt: event.attempt,
      workerId: event.worker_id,
      leaseExpiresAt: this.nextLeaseExpiry(),
    };

    if (event.event_type === 'job.accepted') {
      await this.applyTransportAccepted(input);
      return;
    }

    await this.applyTransportHeartbeat(input);
  }

  private assertMonotonicStage(
    currentStage: VideoPipelineStage,
    nextStage: VideoPipelineStage,
    status: string,
  ): void {
    if (!VIDEO_ACTIVE_JOB_STATUSES.has(status as never)) {
      return;
    }

    const currentIndex = VIDEO_PIPELINE_STAGE_INDEX[currentStage] ?? 0;
    const nextIndex = VIDEO_PIPELINE_STAGE_INDEX[nextStage] ?? 0;

    if (nextIndex < currentIndex) {
      throw new ConflictException('Video job stage cannot move backwards');
    }
  }

  private isDuplicateCallback(idempotencyKey?: string): boolean {
    if (!idempotencyKey) {
      return false;
    }

    return this.callbackIdempotencyKeys.has(idempotencyKey);
  }

  private rememberCallback(idempotencyKey?: string): void {
    if (!idempotencyKey) {
      return;
    }

    this.callbackIdempotencyKeys.set(idempotencyKey, Date.now());
  }

  private async maybeAutoRetry(
    event: Extract<VideoTransportEvent, { event_type: 'job.failed' }>,
  ): Promise<void> {
    if (!event.payload.is_retryable) {
      return;
    }

    const job = await this.videoJobsRepository.findVideoJobById(event.job_id);
    if (!job || job.current_attempt >= this.maxAttempts()) {
      return;
    }

    const refreshed = await this.resetAndReloadJob(event.job_id);
    if (!refreshed) {
      return;
    }

    await this.enqueueJob(
      refreshed,
      null,
      this.retryDelayMs(refreshed.retry_count),
    );
  }

  private maxAttempts(): number {
    return this.configService.get<number>('VIDEO_AUTO_RETRY_MAX_ATTEMPTS', 3);
  }

  private async readStoredVideoAsset(
    objectKey: string,
  ): Promise<{ bytes: Uint8Array; contentType: string | null }> {
    const response = await this.storageService.getObject(objectKey);
    const body = response.Body as
      | { transformToByteArray?: () => Promise<Uint8Array> }
      | undefined;

    if (!body?.transformToByteArray) {
      throw new Error('Stored final video body is not readable');
    }

    return {
      bytes: await body.transformToByteArray(),
      contentType: response.ContentType ?? null,
    };
  }

  private buildPlaybackUrl(job: VideoJobRecord): string | null {
    if (job.bunny_library_id && job.bunny_video_id) {
      return this.bunnyStreamService.buildEmbedUrl(
        job.bunny_video_id,
        job.bunny_library_id,
      );
    }

    if (job.final_video_object_key) {
      return this.storageService.createObjectUrl(job.final_video_object_key);
    }

    return null;
  }

  private buildPlaybackStatus(job: VideoJobRecord): string {
    if (job.status === 'completed') {
      return 'playable';
    }

    if (job.pipeline_stage === 'stream_processing') {
      return 'processing';
    }

    return 'unavailable';
  }

  private retryDelayMs(retryCount: number): number {
    if (retryCount <= 1) {
      return 30_000;
    }

    if (retryCount === 2) {
      return 120_000;
    }

    return 600_000;
  }

  private nextLeaseExpiry(): Date {
    const ttlMs = this.configService.get<number>(
      'VIDEO_WORKER_LEASE_TTL_MS',
      45_000,
    );
    return new Date(Date.now() + ttlMs);
  }

  private toVideoJobItem(job: VideoJobRecord) {
    return {
      id: job.id,
      document_id: job.document_id,
      status: job.status,
      pipeline_stage: job.pipeline_stage,
      progress_pct: job.progress_pct,
      target_duration_sec: job.target_duration_sec,
      voice: job.voice,
      language: job.language,
      retry_count: job.retry_count,
      error_code: job.error_code,
      error_message: job.error_message,
      created_at: job.created_at.toISOString(),
      updated_at: job.updated_at.toISOString(),
      completed_at: job.completed_at?.toISOString() ?? null,
    };
  }
}
