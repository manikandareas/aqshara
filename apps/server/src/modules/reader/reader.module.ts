import { Module } from '@nestjs/common';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { ReaderArtifactBuilder } from './reader-artifact.builder';
import { ReaderController } from './reader.controller';
import { ReaderMarkdownService } from './reader-markdown.service';
import { ReaderRepository } from './reader.repository';
import { ReaderService } from './reader.service';

@Module({
  imports: [DocumentsModule, AiModule],
  controllers: [ReaderController],
  providers: [
    ReaderService,
    ReaderRepository,
    ReaderArtifactBuilder,
    ReaderMarkdownService,
  ],
  exports: [ReaderService, ReaderRepository, ReaderMarkdownService],
})
export class ReaderModule {}
