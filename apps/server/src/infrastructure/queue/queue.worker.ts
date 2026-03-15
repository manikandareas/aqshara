import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { MetricsService } from '../../observability/metrics.service';
import { buildBullConnection } from './queue.connection';

@Injectable()
export class QueueWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkerService.name);
  private worker?: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  onModuleInit(): void {
    const queueName = this.configService.getOrThrow<string>(
      'DOCUMENT_PROCESS_QUEUE_NAME',
    );
    const bullConnection = buildBullConnection(
      this.configService.getOrThrow<string>('REDIS_URL'),
    );

    this.worker = new Worker(
      queueName,
      async (job: Job) => {
        await Promise.resolve();
        this.logger.log(`Processed bootstrap job ${job.id}`);
        this.metricsService.incrementQueueJob(queueName, 'completed');
      },
      { connection: bullConnection, skipVersionCheck: true },
    );

    this.worker.on('failed', (job, error) => {
      this.metricsService.incrementQueueJob(queueName, 'failed');
      this.logger.error(
        `Bootstrap worker failed for ${job?.id}: ${error.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
