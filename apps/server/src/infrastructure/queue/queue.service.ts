import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import type {
  DocumentProcessJobPayload,
  TranslationRetryJobPayload,
} from '../../modules/pipeline/pipeline-job.schemas';
import type { VideoGenerateJobPayload } from '../../modules/video-jobs/video-job.schemas';
import { MetricsService } from '../../observability/metrics.service';
import { buildBullConnection } from './queue.connection';
import { REDIS_CONNECTION } from './queue.constants';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly documentProcessQueue?: Queue;
  private readonly documentProcessRetryQueue?: Queue;
  private readonly documentProcessDlqQueue?: Queue;
  private readonly translationRetryQueue?: Queue;
  private readonly translationRetryRetryQueue?: Queue;
  private readonly translationRetryDlqQueue?: Queue;
  private readonly videoGenerateQueue?: Queue;
  private readonly videoGenerateRetryQueue?: Queue;
  private readonly videoGenerateDlqQueue?: Queue;
  private readonly queueDisabled: boolean;

  readonly queueNames: Record<string, string>;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.queueDisabled = this.configService.get<boolean>(
      'QUEUE_DISABLED',
      false,
    );

    this.queueNames = {
      documentProcess: this.configService.getOrThrow<string>(
        'DOCUMENT_PROCESS_QUEUE_NAME',
      ),
      documentProcessRetry: this.configService.getOrThrow<string>(
        'DOCUMENT_PROCESS_RETRY_QUEUE_NAME',
      ),
      documentProcessDlq: this.configService.getOrThrow<string>(
        'DOCUMENT_PROCESS_DLQ_QUEUE_NAME',
      ),
      translationRetry: this.configService.getOrThrow<string>(
        'TRANSLATION_RETRY_QUEUE_NAME',
      ),
      translationRetryRetry: this.configService.getOrThrow<string>(
        'TRANSLATION_RETRY_RETRY_QUEUE_NAME',
      ),
      translationRetryDlq: this.configService.getOrThrow<string>(
        'TRANSLATION_RETRY_DLQ_QUEUE_NAME',
      ),
      videoGenerate: this.configService.getOrThrow<string>(
        'VIDEO_GENERATE_QUEUE_NAME',
      ),
      videoGenerateRetry: this.configService.getOrThrow<string>(
        'VIDEO_GENERATE_RETRY_QUEUE_NAME',
      ),
      videoGenerateDlq: this.configService.getOrThrow<string>(
        'VIDEO_GENERATE_DLQ_QUEUE_NAME',
      ),
    };

    if (this.queueDisabled) {
      return;
    }

    const bullConnection = buildBullConnection(
      this.configService.getOrThrow<string>('REDIS_URL'),
    );

    const defaultJobOptions = {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
    };

    this.documentProcessQueue = new Queue(this.queueNames.documentProcess, {
      connection: bullConnection,
      defaultJobOptions,
      skipVersionCheck: true,
    });

    this.documentProcessRetryQueue = new Queue(
      this.queueNames.documentProcessRetry,
      {
        connection: bullConnection,
        defaultJobOptions,
        skipVersionCheck: true,
      },
    );

    this.documentProcessDlqQueue = new Queue(
      this.queueNames.documentProcessDlq,
      {
        connection: bullConnection,
        defaultJobOptions,
        skipVersionCheck: true,
      },
    );

    this.translationRetryQueue = new Queue(this.queueNames.translationRetry, {
      connection: bullConnection,
      defaultJobOptions,
      skipVersionCheck: true,
    });

    this.translationRetryRetryQueue = new Queue(
      this.queueNames.translationRetryRetry,
      {
        connection: bullConnection,
        defaultJobOptions,
        skipVersionCheck: true,
      },
    );

    this.translationRetryDlqQueue = new Queue(
      this.queueNames.translationRetryDlq,
      {
        connection: bullConnection,
        defaultJobOptions,
        skipVersionCheck: true,
      },
    );

    this.videoGenerateQueue = new Queue(this.queueNames.videoGenerate, {
      connection: bullConnection,
      defaultJobOptions,
      skipVersionCheck: true,
    });

    this.videoGenerateRetryQueue = new Queue(
      this.queueNames.videoGenerateRetry,
      {
        connection: bullConnection,
        defaultJobOptions,
        skipVersionCheck: true,
      },
    );

    this.videoGenerateDlqQueue = new Queue(this.queueNames.videoGenerateDlq, {
      connection: bullConnection,
      defaultJobOptions,
      skipVersionCheck: true,
    });
  }

  async enqueueDocumentProcess(
    payload: DocumentProcessJobPayload,
  ): Promise<Job> {
    if (!this.documentProcessQueue) {
      throw new Error('Document process queue is disabled');
    }

    const job = await this.documentProcessQueue.add(
      'document.process',
      payload,
    );
    this.metricsService.incrementQueueJob(
      this.queueNames.documentProcess,
      'enqueued',
    );
    return job;
  }

  async enqueueDocumentProcessRetry(
    payload: DocumentProcessJobPayload,
  ): Promise<Job> {
    if (!this.documentProcessRetryQueue) {
      throw new Error('Document process retry queue is disabled');
    }

    const job = await this.documentProcessRetryQueue.add(
      'document.process.retry',
      payload,
    );
    this.metricsService.incrementQueueJob(
      this.queueNames.documentProcessRetry,
      'enqueued',
    );
    return job;
  }

  async enqueueDocumentProcessDlq(
    payload: DocumentProcessJobPayload,
  ): Promise<Job> {
    if (!this.documentProcessDlqQueue) {
      throw new Error('Document process DLQ queue is disabled');
    }

    const job = await this.documentProcessDlqQueue.add(
      'document.process.dlq',
      payload,
    );
    this.metricsService.incrementQueueJob(
      this.queueNames.documentProcessDlq,
      'enqueued',
    );
    return job;
  }

  async enqueueTranslationRetry(
    payload: TranslationRetryJobPayload,
  ): Promise<Job> {
    if (!this.translationRetryQueue) {
      throw new Error('Translation retry queue is disabled');
    }

    const job = await this.translationRetryQueue.add(
      'translation.retry',
      payload,
    );
    this.metricsService.incrementQueueJob(
      this.queueNames.translationRetry,
      'enqueued',
    );
    return job;
  }

  async enqueueTranslationRetryRetry(
    payload: TranslationRetryJobPayload,
  ): Promise<Job> {
    if (!this.translationRetryRetryQueue) {
      throw new Error('Translation retry retry queue is disabled');
    }

    const job = await this.translationRetryRetryQueue.add(
      'translation.retry.retry',
      payload,
    );
    this.metricsService.incrementQueueJob(
      this.queueNames.translationRetryRetry,
      'enqueued',
    );
    return job;
  }

  async enqueueTranslationRetryDlq(
    payload: TranslationRetryJobPayload,
  ): Promise<Job> {
    if (!this.translationRetryDlqQueue) {
      throw new Error('Translation retry DLQ queue is disabled');
    }

    const job = await this.translationRetryDlqQueue.add(
      'translation.retry.dlq',
      payload,
    );
    this.metricsService.incrementQueueJob(
      this.queueNames.translationRetryDlq,
      'enqueued',
    );
    return job;
  }

  async enqueueVideoGenerate(
    payload: VideoGenerateJobPayload,
    options?: { delayMs?: number },
  ): Promise<Job> {
    if (!this.videoGenerateQueue) {
      throw new Error('Video generate queue is disabled');
    }

    const job = await this.videoGenerateQueue.add('video.generate', payload, {
      delay: options?.delayMs ?? 0,
    });
    this.metricsService.incrementQueueJob(
      this.queueNames.videoGenerate,
      'enqueued',
    );
    return job;
  }

  async enqueueVideoGenerateRetry(
    payload: VideoGenerateJobPayload,
  ): Promise<Job> {
    if (!this.videoGenerateRetryQueue) {
      throw new Error('Video generate retry queue is disabled');
    }

    const job = await this.videoGenerateRetryQueue.add(
      'video.generate.retry',
      payload,
    );
    this.metricsService.incrementQueueJob(
      this.queueNames.videoGenerateRetry,
      'enqueued',
    );
    return job;
  }

  async enqueueVideoGenerateDlq(
    payload: VideoGenerateJobPayload,
  ): Promise<Job> {
    if (!this.videoGenerateDlqQueue) {
      throw new Error('Video generate DLQ queue is disabled');
    }

    const job = await this.videoGenerateDlqQueue.add(
      'video.generate.dlq',
      payload,
    );
    this.metricsService.incrementQueueJob(
      this.queueNames.videoGenerateDlq,
      'enqueued',
    );
    return job;
  }

  async isReady(): Promise<{ ready: boolean }> {
    if (this.queueDisabled) {
      return { ready: true };
    }

    try {
      const pong = await this.redis.ping();
      return { ready: pong === 'PONG' };
    } catch {
      return { ready: false };
    }
  }

  async recordQueueDepthMetrics(): Promise<void> {
    const statuses = ['waiting', 'active', 'delayed', 'failed'] as const;

    if (this.queueDisabled) {
      for (const queueName of Object.values(this.queueNames)) {
        for (const status of statuses) {
          this.metricsService.setQueueDepth(queueName, status, 0);
        }
      }
      return;
    }

    const queues: Array<{ name: string; queue: Queue | undefined }> = [
      {
        name: this.queueNames.documentProcess,
        queue: this.documentProcessQueue,
      },
      {
        name: this.queueNames.documentProcessRetry,
        queue: this.documentProcessRetryQueue,
      },
      {
        name: this.queueNames.documentProcessDlq,
        queue: this.documentProcessDlqQueue,
      },
      {
        name: this.queueNames.translationRetry,
        queue: this.translationRetryQueue,
      },
      {
        name: this.queueNames.translationRetryRetry,
        queue: this.translationRetryRetryQueue,
      },
      {
        name: this.queueNames.translationRetryDlq,
        queue: this.translationRetryDlqQueue,
      },
      {
        name: this.queueNames.videoGenerate,
        queue: this.videoGenerateQueue,
      },
      {
        name: this.queueNames.videoGenerateRetry,
        queue: this.videoGenerateRetryQueue,
      },
      {
        name: this.queueNames.videoGenerateDlq,
        queue: this.videoGenerateDlqQueue,
      },
    ];

    for (const entry of queues) {
      if (!entry.queue) {
        continue;
      }

      const counts = await entry.queue.getJobCounts(...statuses);
      for (const status of statuses) {
        this.metricsService.setQueueDepth(
          entry.name,
          status,
          counts[status] ?? 0,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    const queueClosures: Promise<void>[] = [];
    if (this.documentProcessQueue) {
      queueClosures.push(this.documentProcessQueue.close());
    }
    if (this.documentProcessRetryQueue) {
      queueClosures.push(this.documentProcessRetryQueue.close());
    }
    if (this.documentProcessDlqQueue) {
      queueClosures.push(this.documentProcessDlqQueue.close());
    }
    if (this.translationRetryQueue) {
      queueClosures.push(this.translationRetryQueue.close());
    }
    if (this.translationRetryRetryQueue) {
      queueClosures.push(this.translationRetryRetryQueue.close());
    }
    if (this.translationRetryDlqQueue) {
      queueClosures.push(this.translationRetryDlqQueue.close());
    }
    if (this.videoGenerateQueue) {
      queueClosures.push(this.videoGenerateQueue.close());
    }
    if (this.videoGenerateRetryQueue) {
      queueClosures.push(this.videoGenerateRetryQueue.close());
    }
    if (this.videoGenerateDlqQueue) {
      queueClosures.push(this.videoGenerateDlqQueue.close());
    }

    await Promise.all(queueClosures);
    await this.redis.quit().catch(() => undefined);
  }
}
