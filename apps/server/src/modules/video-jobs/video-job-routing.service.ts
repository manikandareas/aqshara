import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService } from '../../infrastructure/queue/queue.service';
import type { VideoGenerateJobPayload } from './video-job.schemas';

@Injectable()
export class VideoJobRoutingService {
  constructor(private readonly queueService: QueueService) {}

  async routeVideoGenerateToRetryOrDlq(
    job: Job<VideoGenerateJobPayload>,
    fromRetryQueue: boolean,
  ): Promise<void> {
    const payload = {
      ...job.data,
      attempt: job.attemptsMade + 1,
    };

    if (fromRetryQueue) {
      await this.queueService.enqueueVideoGenerateDlq(payload);
      return;
    }

    await this.queueService.enqueueVideoGenerateRetry(payload);
  }
}
