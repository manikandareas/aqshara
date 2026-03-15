import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { EngagementController } from './engagement.controller';
import { EngagementRepository } from './engagement.repository';
import { EngagementService } from './engagement.service';

@Module({
  imports: [DocumentsModule],
  controllers: [EngagementController],
  providers: [EngagementService, EngagementRepository],
  exports: [EngagementService, EngagementRepository],
})
export class EngagementModule {}
