import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../infrastructure/ai/ai.service';
import { MistralOcrService } from '../../infrastructure/ocr/mistral-ocr.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { DocumentsService } from '../documents/documents.service';
import { ReaderService } from '../reader/reader.service';
import { VideoJobsService } from '../video-jobs/video-jobs.service';
import type { DocumentProcessJobPayload } from './pipeline-job.schemas';
import {
  PIPELINE_STAGE_EXTRACT,
  PIPELINE_STAGE_OCR,
} from './pipeline.constants';

@Injectable()
export class PipelineDocumentProcessorService {
  private readonly logger = new Logger(PipelineDocumentProcessorService.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly readerService: ReaderService,
    private readonly storageService: StorageService,
    private readonly mistralOcrService: MistralOcrService,
    private readonly aiService: AiService,
    private readonly videoJobsService: VideoJobsService,
  ) {}

  async process(job: DocumentProcessJobPayload): Promise<void> {
    this.logger.log({
      message: 'Starting document pipeline processing',
      request_id: job.request_id ?? null,
      document_id: job.document_id,
      actor_id: job.actor_id,
    });

    const context = await this.documentsService.getPipelineProcessingContext(
      job.document_id,
    );

    if (context.status === 'ready') {
      this.logger.log({
        message: 'Skipping document because it is already ready',
        request_id: job.request_id ?? null,
        document_id: job.document_id,
      });
      return;
    }

    let activeStage = PIPELINE_STAGE_OCR;
    await this.documentsService.startPipelineStage(
      job.document_id,
      activeStage,
    );

    try {
      const sourceObject = await this.storageService.getObject(
        context.source_object_key,
      );
      const sourceBuffer = await this.objectBodyToBuffer(sourceObject.Body);

      const ocrResult = await this.mistralOcrService.processPdf(
        context.id,
        context.filename,
        sourceBuffer,
      );

      const artifactKey = this.storageService.createDocumentOcrArtifactKey(
        context.id,
      );

      await this.storageService.uploadObject(
        artifactKey,
        JSON.stringify(ocrResult),
        'application/json',
      );

      const sourceLang = await this.aiService.detectSourceLanguage(
        this.buildLanguageSample(ocrResult),
      );
      await this.documentsService.setDocumentSourceLanguage(
        context.id,
        sourceLang,
      );
      await this.documentsService.markPipelineStageDone(
        context.id,
        activeStage,
      );

      activeStage = PIPELINE_STAGE_EXTRACT;
      await this.documentsService.startPipelineStage(context.id, activeStage);
      await this.readerService.rebuildArtifactsFromOcrResult(
        context.id,
        ocrResult,
        context.require_translate,
        sourceLang,
      );

      if (context.require_translate) {
        await this.readerService.enqueueInitialTranslationJobs({
          documentId: context.id,
          actorId: job.actor_id,
          requestId: job.request_id ?? undefined,
        });
      }

      const pageCount = Array.isArray(ocrResult.pages)
        ? ocrResult.pages.length
        : null;

      await this.documentsService.completePipelineStage(
        context.id,
        activeStage,
        pageCount,
      );

      if (context.require_video_generation) {
        await this.videoJobsService.ensureAutoVideoJobForReadyDocument({
          documentId: context.id,
          ownerId: context.owner_id,
          requestId: job.request_id ?? undefined,
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Document pipeline processing failed',
        request_id: job.request_id ?? null,
        document_id: context.id,
        actor_id: job.actor_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await this.documentsService.failPipelineAttempt(context.id, activeStage);
      throw error;
    }
  }

  async processDlq(job: DocumentProcessJobPayload): Promise<void> {
    this.logger.error({
      message: 'Processing document DLQ terminal path',
      request_id: job.request_id ?? null,
      document_id: job.document_id,
      actor_id: job.actor_id,
    });
    await this.documentsService.failPipelineTerminal(
      job.document_id,
      PIPELINE_STAGE_OCR,
    );
  }

  private async objectBodyToBuffer(body: unknown): Promise<Buffer> {
    if (Buffer.isBuffer(body)) {
      return body;
    }

    if (
      body &&
      typeof body === 'object' &&
      'transformToByteArray' in body &&
      typeof (body as { transformToByteArray?: unknown })
        .transformToByteArray === 'function'
    ) {
      const bytes = await (
        body as { transformToByteArray: () => Promise<Uint8Array> }
      ).transformToByteArray();
      return Buffer.from(bytes);
    }

    throw new Error('Unable to read source PDF body from storage response');
  }

  private buildLanguageSample(ocrResult: {
    pages?: Array<{ markdown?: string }>;
  }): string {
    const chunks: string[] = [];
    for (const page of ocrResult.pages ?? []) {
      const markdown = typeof page.markdown === 'string' ? page.markdown : '';
      if (!markdown.trim()) {
        continue;
      }
      const pageChunks = markdown
        .split(/\n\s*\n+/g)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      for (const chunk of pageChunks) {
        chunks.push(chunk);
        if (chunks.length >= 8) {
          return chunks.join('\n\n').slice(0, 6000);
        }
      }
    }
    return chunks.join('\n\n').slice(0, 6000);
  }
}
