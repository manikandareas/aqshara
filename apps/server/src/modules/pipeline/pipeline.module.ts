import { Module } from '@nestjs/common';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { OcrModule } from '../../infrastructure/ocr/ocr.module';
import { DocumentsModule } from '../documents/documents.module';
import { ReaderModule } from '../reader/reader.module';
import { VideoJobsModule } from '../video-jobs/video-jobs.module';
import { PipelineDocumentProcessorService } from './pipeline-document-processor.service';
import { PipelineJobRoutingService } from './pipeline-job-routing.service';
import { PipelineTranslationRetryProcessorService } from './pipeline-translation-retry-processor.service';

@Module({
  imports: [
    DocumentsModule,
    ReaderModule,
    OcrModule,
    AiModule,
    VideoJobsModule,
  ],
  providers: [
    PipelineDocumentProcessorService,
    PipelineTranslationRetryProcessorService,
    PipelineJobRoutingService,
  ],
  exports: [
    PipelineDocumentProcessorService,
    PipelineTranslationRetryProcessorService,
    PipelineJobRoutingService,
  ],
})
export class PipelineModule {}
