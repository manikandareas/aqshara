import { Injectable, Logger } from '@nestjs/common';
import type { VideoGenerateJobPayload } from './video-job.schemas';
import { VideoWorkerBridgeService } from './video-worker-bridge.service';
import { VideoJobsService } from './video-jobs.service';

@Injectable()
export class VideoJobProcessorService {
  private readonly logger = new Logger(VideoJobProcessorService.name);

  constructor(
    private readonly videoJobsService: VideoJobsService,
    private readonly videoWorkerBridgeService: VideoWorkerBridgeService,
  ) {}

  async process(job: VideoGenerateJobPayload): Promise<void> {
    const current = await this.videoJobsService.getVideoJobForWorker(
      job.video_job_id,
    );

    if (!current || current.status === 'completed') {
      return;
    }

    this.logger.log({
      message: 'Dispatching video generation job to Python worker',
      video_job_id: job.video_job_id,
      document_id: job.document_id,
      actor_id: job.actor_id,
      request_id: job.request_id ?? null,
      attempt: job.attempt,
    });

    await this.videoWorkerBridgeService.run({
      ...job,
      target_duration_sec: current.target_duration_sec,
      voice: current.voice,
      language: current.language,
    });
  }

  async processDlq(job: VideoGenerateJobPayload): Promise<void> {
    this.logger.error({
      message: 'Processing video generation DLQ terminal path',
      video_job_id: job.video_job_id,
      document_id: job.document_id,
      actor_id: job.actor_id,
      request_id: job.request_id ?? null,
    });

    await this.videoJobsService.applyInternalFail(job.video_job_id, {
      pipeline_stage: 'failed',
      error_code: 'VIDEO_JOB_RETRY_EXHAUSTED',
      error_message: 'Video job exhausted retry attempts',
    });
  }
}
