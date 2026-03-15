import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { buildBullConnection } from '../../infrastructure/queue/queue.connection';
import { MetricsService } from '../../observability/metrics.service';
import { PipelineDocumentProcessorService } from './pipeline-document-processor.service';
import { PipelineJobRoutingService } from './pipeline-job-routing.service';
import { PipelineTranslationRetryProcessorService } from './pipeline-translation-retry-processor.service';
import {
  parseDocumentProcessJobPayload,
  parseTranslationRetryJobPayload,
} from './pipeline-job.schemas';
import { VideoJobRoutingService } from '../video-jobs/video-job-routing.service';
import { VideoJobProcessorService } from '../video-jobs/video-job-processor.service';
import { parseVideoGenerateJobPayload } from '../video-jobs/video-job.schemas';

@Injectable()
export class PipelineWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PipelineWorkerService.name);
  private readonly workers: Worker[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly metricsService: MetricsService,
    private readonly pipelineJobRoutingService: PipelineJobRoutingService,
    private readonly documentProcessor: PipelineDocumentProcessorService,
    private readonly translationRetryProcessor: PipelineTranslationRetryProcessorService,
    private readonly videoJobRoutingService: VideoJobRoutingService,
    private readonly videoJobProcessor: VideoJobProcessorService,
  ) {}

  onModuleInit(): void {
    const queueDisabled = this.configService.get<boolean>(
      'QUEUE_DISABLED',
      false,
    );
    if (queueDisabled) {
      this.logger.warn('Queue workers disabled by QUEUE_DISABLED=true');
      return;
    }

    const connection = buildBullConnection(
      this.configService.getOrThrow<string>('REDIS_URL'),
    );

    this.workers.push(
      this.createWorker(
        this.queueService.queueNames.documentProcess,
        async (job) => {
          try {
            const payload = parseDocumentProcessJobPayload(job.data);
            this.logger.log({
              message: 'Processing document job',
              queue: this.queueService.queueNames.documentProcess,
              job_id: job.id,
              request_id: payload.request_id ?? null,
              document_id: payload.document_id,
              actor_id: payload.actor_id,
              attempt: job.attemptsMade + 1,
            });
            await this.documentProcessor.process(payload);
          } catch (error) {
            await this.pipelineJobRoutingService.routeDocumentToRetryOrDlq(
              job,
              false,
            );
            throw error;
          }
        },
        connection,
      ),
    );

    this.workers.push(
      this.createWorker(
        this.queueService.queueNames.documentProcessRetry,
        async (job) => {
          try {
            const payload = parseDocumentProcessJobPayload(job.data);
            this.logger.log({
              message: 'Processing document retry job',
              queue: this.queueService.queueNames.documentProcessRetry,
              job_id: job.id,
              request_id: payload.request_id ?? null,
              document_id: payload.document_id,
              actor_id: payload.actor_id,
              attempt: job.attemptsMade + 1,
            });
            await this.documentProcessor.process(payload);
          } catch (error) {
            await this.pipelineJobRoutingService.routeDocumentToRetryOrDlq(
              job,
              true,
            );
            throw error;
          }
        },
        connection,
      ),
    );

    this.workers.push(
      this.createWorker(
        this.queueService.queueNames.documentProcessDlq,
        async (job) => {
          const payload = parseDocumentProcessJobPayload(job.data);
          this.logger.log({
            message: 'Processing document DLQ job',
            queue: this.queueService.queueNames.documentProcessDlq,
            job_id: job.id,
            request_id: payload.request_id ?? null,
            document_id: payload.document_id,
            actor_id: payload.actor_id,
            attempt: job.attemptsMade + 1,
          });
          await this.documentProcessor.processDlq(payload);
        },
        connection,
      ),
    );

    this.workers.push(
      this.createWorker(
        this.queueService.queueNames.translationRetry,
        async (job) => {
          try {
            const payload = parseTranslationRetryJobPayload(job.data);
            this.logger.log({
              message: 'Processing translation retry job',
              queue: this.queueService.queueNames.translationRetry,
              job_id: job.id,
              request_id: payload.request_id ?? null,
              document_id: payload.document_id,
              paragraph_id: payload.paragraph_id,
              actor_id: payload.actor_id,
              attempt: job.attemptsMade + 1,
            });
            await this.translationRetryProcessor.process(payload);
          } catch (error) {
            await this.pipelineJobRoutingService.routeTranslationToRetryOrDlq(
              job,
              false,
            );
            throw error;
          }
        },
        connection,
      ),
    );

    this.workers.push(
      this.createWorker(
        this.queueService.queueNames.translationRetryRetry,
        async (job) => {
          try {
            const payload = parseTranslationRetryJobPayload(job.data);
            this.logger.log({
              message: 'Processing translation second-attempt job',
              queue: this.queueService.queueNames.translationRetryRetry,
              job_id: job.id,
              request_id: payload.request_id ?? null,
              document_id: payload.document_id,
              paragraph_id: payload.paragraph_id,
              actor_id: payload.actor_id,
              attempt: job.attemptsMade + 1,
            });
            await this.translationRetryProcessor.process(payload);
          } catch (error) {
            await this.pipelineJobRoutingService.routeTranslationToRetryOrDlq(
              job,
              true,
            );
            throw error;
          }
        },
        connection,
      ),
    );

    this.workers.push(
      this.createWorker(
        this.queueService.queueNames.translationRetryDlq,
        async (job) => {
          const payload = parseTranslationRetryJobPayload(job.data);
          this.logger.log({
            message: 'Processing translation DLQ job',
            queue: this.queueService.queueNames.translationRetryDlq,
            job_id: job.id,
            request_id: payload.request_id ?? null,
            document_id: payload.document_id,
            paragraph_id: payload.paragraph_id,
            actor_id: payload.actor_id,
            attempt: job.attemptsMade + 1,
          });
          await this.translationRetryProcessor.processDlq(payload);
        },
        connection,
      ),
    );

    this.workers.push(
      this.createWorker(
        this.queueService.queueNames.videoGenerate,
        async (job) => {
          try {
            const payload = parseVideoGenerateJobPayload(job.data);
            this.logger.log({
              message: 'Processing video generation job',
              queue: this.queueService.queueNames.videoGenerate,
              job_id: job.id,
              request_id: payload.request_id ?? null,
              video_job_id: payload.video_job_id,
              document_id: payload.document_id,
              actor_id: payload.actor_id,
              attempt: job.attemptsMade + 1,
            });
            await this.videoJobProcessor.process(payload);
          } catch (error) {
            await this.videoJobRoutingService.routeVideoGenerateToRetryOrDlq(
              job,
              false,
            );
            throw error;
          }
        },
        connection,
      ),
    );

    this.workers.push(
      this.createWorker(
        this.queueService.queueNames.videoGenerateRetry,
        async (job) => {
          try {
            const payload = parseVideoGenerateJobPayload(job.data);
            this.logger.log({
              message: 'Processing video generation retry job',
              queue: this.queueService.queueNames.videoGenerateRetry,
              job_id: job.id,
              request_id: payload.request_id ?? null,
              video_job_id: payload.video_job_id,
              document_id: payload.document_id,
              actor_id: payload.actor_id,
              attempt: job.attemptsMade + 1,
            });
            await this.videoJobProcessor.process(payload);
          } catch (error) {
            await this.videoJobRoutingService.routeVideoGenerateToRetryOrDlq(
              job,
              true,
            );
            throw error;
          }
        },
        connection,
      ),
    );

    this.workers.push(
      this.createWorker(
        this.queueService.queueNames.videoGenerateDlq,
        async (job) => {
          const payload = parseVideoGenerateJobPayload(job.data);
          this.logger.log({
            message: 'Processing video generation DLQ job',
            queue: this.queueService.queueNames.videoGenerateDlq,
            job_id: job.id,
            request_id: payload.request_id ?? null,
            video_job_id: payload.video_job_id,
            document_id: payload.document_id,
            actor_id: payload.actor_id,
            attempt: job.attemptsMade + 1,
          });
          await this.videoJobProcessor.processDlq(payload);
        },
        connection,
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }

  private createWorker(
    queueName: string,
    processor: (job: Job) => Promise<void>,
    connection: ReturnType<typeof buildBullConnection>,
  ): Worker {
    const worker = new Worker(queueName, processor, {
      connection,
      skipVersionCheck: true,
    });

    worker.on('completed', () => {
      this.metricsService.incrementQueueJob(queueName, 'completed');
    });

    worker.on('failed', (job, error) => {
      this.metricsService.incrementQueueJob(queueName, 'failed');
      const payload = job?.data as
        | {
            request_id?: string | null;
            document_id?: string;
            paragraph_id?: string;
          }
        | undefined;

      this.logger.error({
        message: 'Queue job failed',
        queue: queueName,
        job_id: job?.id,
        request_id: payload?.request_id ?? null,
        document_id: payload?.document_id ?? null,
        paragraph_id: payload?.paragraph_id ?? null,
        error: error.message,
      });
    });

    return worker;
  }
}
