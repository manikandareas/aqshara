import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { MetricsService } from '../../observability/metrics.service';
import {
  parseDocumentProcessJobPayload,
  parseTranslationRetryJobPayload,
} from './pipeline-job.schemas';

@Injectable()
export class PipelineJobRoutingService {
  constructor(
    private readonly queueService: QueueService,
    private readonly metricsService: MetricsService,
  ) {}

  async routeDocumentToRetryOrDlq(
    job: Job,
    fromRetryQueue: boolean,
  ): Promise<void> {
    const payload = parseDocumentProcessJobPayload(job.data);

    if (fromRetryQueue) {
      await this.queueService.enqueueDocumentProcessDlq(payload);
      this.metricsService.incrementQueueJob(
        this.queueService.queueNames.documentProcessDlq,
        'enqueued',
      );
      return;
    }

    await this.queueService.enqueueDocumentProcessRetry(payload);
    this.metricsService.incrementQueueJob(
      this.queueService.queueNames.documentProcessRetry,
      'enqueued',
    );
  }

  async routeTranslationToRetryOrDlq(
    job: Job,
    fromRetryQueue: boolean,
  ): Promise<void> {
    const payload = parseTranslationRetryJobPayload(job.data);

    if (fromRetryQueue) {
      await this.queueService.enqueueTranslationRetryDlq(payload);
      this.metricsService.incrementQueueJob(
        this.queueService.queueNames.translationRetryDlq,
        'enqueued',
      );
      return;
    }

    await this.queueService.enqueueTranslationRetryRetry(payload);
    this.metricsService.incrementQueueJob(
      this.queueService.queueNames.translationRetryRetry,
      'enqueued',
    );
  }
}
