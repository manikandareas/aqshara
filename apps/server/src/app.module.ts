import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { ReaderModule } from './modules/reader/reader.module';
import { VideoJobsModule } from './modules/video-jobs/video-jobs.module';
import { ObservabilityModule } from './observability/observability.module';
import { PlatformModule } from './platform/platform.module';

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
        genReqId(req, res) {
          const incomingId = req.headers['x-request-id'];
          const requestId =
            typeof incomingId === 'string' && incomingId.length > 0
              ? incomingId
              : crypto.randomUUID();

          res.setHeader('x-request-id', requestId);
          return requestId;
        },
        customAttributeKeys: {
          reqId: 'request_id',
        },
      },
    }),
    ObservabilityModule,
    DatabaseModule,
    QueueModule,
    StorageModule,
    AuthModule,
    DocumentsModule,
    PipelineModule,
    ReaderModule,
    VideoJobsModule,
    BillingModule,
    EngagementModule,
    PlatformModule,
  ],
})
export class AppModule {}
