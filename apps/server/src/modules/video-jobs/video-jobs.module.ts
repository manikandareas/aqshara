import { Module } from '@nestjs/common';
import { VideoDeliveryModule } from '../../infrastructure/video-delivery/video-delivery.module';
import { DocumentsModule } from '../documents/documents.module';
import {
  InternalVideoJobsController,
  VideoJobsController,
} from './video-jobs.controller';
import { VideoJobProcessorService } from './video-job-processor.service';
import { VideoJobRoutingService } from './video-job-routing.service';
import { VideoTransportService } from './video-transport.service';
import { VideoWorkerBridgeService } from './video-worker-bridge.service';
import { VideoJobsInternalAuthService } from './video-jobs-internal-auth.service';
import { VideoJobsRepository } from './video-jobs.repository';
import { VideoJobsService } from './video-jobs.service';

@Module({
  imports: [DocumentsModule, VideoDeliveryModule],
  controllers: [VideoJobsController, InternalVideoJobsController],
  providers: [
    VideoJobsRepository,
    VideoJobsService,
    VideoJobsInternalAuthService,
    VideoJobRoutingService,
    VideoJobProcessorService,
    VideoWorkerBridgeService,
    VideoTransportService,
  ],
  exports: [
    VideoJobsService,
    VideoJobRoutingService,
    VideoJobProcessorService,
    VideoWorkerBridgeService,
    VideoJobsRepository,
    VideoTransportService,
  ],
})
export class VideoJobsModule {}
