import { Module } from '@nestjs/common';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { VideoDeliveryModule } from '../../infrastructure/video-delivery/video-delivery.module';
import { DocumentsModule } from '../documents/documents.module';
import { VideoCreativeService } from './remotion/video-creative.service';
import { VideoJobsController } from './video-jobs.controller';
import { RemotionRenderService } from './remotion/remotion-render.service';
import { VideoGenerationRunnerService } from './remotion/video-generation-runner.service';
import { VideoMediaProbeService } from './remotion/video-media-probe.service';
import { VideoNarrationService } from './remotion/video-narration.service';
import { VideoJobProcessorService } from './video-job-processor.service';
import { VideoJobRoutingService } from './video-job-routing.service';
import { VideoJobsRepository } from './video-jobs.repository';
import { VideoJobsService } from './video-jobs.service';

@Module({
  imports: [AiModule, DocumentsModule, VideoDeliveryModule],
  controllers: [VideoJobsController],
  providers: [
    VideoJobsRepository,
    VideoJobsService,
    VideoJobRoutingService,
    VideoJobProcessorService,
    VideoCreativeService,
    VideoNarrationService,
    VideoMediaProbeService,
    RemotionRenderService,
    VideoGenerationRunnerService,
  ],
  exports: [
    VideoJobsService,
    VideoJobRoutingService,
    VideoJobProcessorService,
    VideoJobsRepository,
    VideoGenerationRunnerService,
  ],
})
export class VideoJobsModule {}
