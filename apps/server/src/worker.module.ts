import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { BillingModule } from './modules/billing/billing.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { PipelineWorkerService } from './modules/pipeline/pipeline.worker.service';
import { ReaderModule } from './modules/reader/reader.module';
import { VideoJobWatchdogService } from './modules/video-jobs/video-job-watchdog.service';
import { VideoJobsModule } from './modules/video-jobs/video-jobs.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')],
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
      },
    }),
    ObservabilityModule,
    DatabaseModule,
    QueueModule,
    StorageModule,
    DocumentsModule,
    PipelineModule,
    ReaderModule,
    VideoJobsModule,
    BillingModule,
  ],
  providers: [
    PipelineWorkerService,
    VideoJobWatchdogService,
  ],
})
export class WorkerModule {}
