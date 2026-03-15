import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MessageEvent } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, from, interval, map, startWith, switchMap } from 'rxjs';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { BunnyStreamService } from '../../infrastructure/video-delivery/bunny-stream.service';
import {
  DOCUMENT_STATUS_STREAM_EVENT,
  DOCUMENT_STATUS_STREAM_POLL_MS,
  INITIAL_DOCUMENT_STATUS,
  INITIAL_PIPELINE_STAGE,
} from './documents.constants';
import {
  DocumentsRepository,
  type DocumentsListInput,
  type ProcessingDocumentContext,
} from './documents.repository';

const PDF_MAGIC = '%PDF-';

export type UploadDocumentFile = {
  originalname: string;
  size: number;
  mimetype: string;
  buffer: Buffer;
};

export type UploadDocumentInput = {
  ownerId: string;
  file: UploadDocumentFile;
  requireTranslate: boolean;
  requireVideoGeneration: boolean;
  requestId?: string;
};

@Injectable()
export class DocumentsService {
  private readonly maxUploadBytes: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentsRepository: DocumentsRepository,
    private readonly storageService: StorageService,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly queueService: QueueService,
  ) {
    this.maxUploadBytes = this.configService.get<number>(
      'DOCUMENT_UPLOAD_MAX_BYTES',
      52_428_800,
    );
  }

  async listDocuments(input: DocumentsListInput) {
    const result = await this.documentsRepository.listOwnedDocuments(input);

    return {
      data: result.rows.map((row) => ({
        id: row.id,
        filename: row.filename,
        status: row.status,
        pipeline_stage: row.pipeline_stage,
        require_translate: row.require_translate,
        require_video_generation: row.require_video_generation,
        source_lang: row.source_lang ?? 'unknown',
        page_count: row.page_count,
        created_at: row.created_at.toISOString(),
      })),
      meta: {
        page: input.page,
        limit: input.limit,
        total: result.total,
      },
    };
  }

  async getDocument(documentId: string, ownerId: string) {
    const row = await this.documentsRepository.findOwnedDocumentById(
      documentId,
      ownerId,
    );

    if (!row) {
      throw new NotFoundException('Document not found');
    }

    const video = await this.documentsRepository.findOwnedDocumentVideoSummary(
      documentId,
      ownerId,
    );

    return {
      data: {
        id: row.id,
        filename: row.filename,
        status: row.status,
        pipeline_stage: row.pipeline_stage,
        require_translate: row.require_translate,
        require_video_generation: row.require_video_generation,
        source_lang: row.source_lang ?? 'unknown',
        page_count: row.page_count,
        title: row.title,
        abstract: row.abstract,
        pdf_type: row.pdf_type,
        ocr_quality: row.ocr_quality,
        processed_at: row.processed_at?.toISOString() ?? null,
        video: video
          ? {
              job_id: video.job_id,
              status: video.status,
              pipeline_stage: video.pipeline_stage,
              progress_pct: video.progress_pct,
              video_url:
                video.bunny_library_id && video.bunny_video_id
                  ? this.bunnyStreamService.buildEmbedUrl(
                      video.bunny_video_id,
                      video.bunny_library_id,
                    )
                  : video.final_video_object_key
                    ? this.storageService.createObjectUrl(
                        video.final_video_object_key,
                      )
                    : null,
              playback_status:
                video.status === 'completed'
                  ? 'playable'
                  : video.pipeline_stage === 'stream_processing'
                    ? 'processing'
                    : 'unavailable',
              thumbnail_url: video.final_thumbnail_object_key
                ? this.storageService.createObjectUrl(
                    video.final_thumbnail_object_key,
                  )
                : null,
              completed_at: video.completed_at?.toISOString() ?? null,
            }
          : null,
        created_at: row.created_at.toISOString(),
      },
    };
  }

  async deleteDocument(documentId: string, ownerId: string): Promise<void> {
    const deleted = await this.documentsRepository.deleteOwnedDocument(
      documentId,
      ownerId,
    );

    if (!deleted) {
      throw new NotFoundException('Document not found');
    }
  }

  async uploadDocument(input: UploadDocumentInput) {
    this.validateUploadFile(input.file);

    const documentId = randomUUID();
    const sourceObjectKey = this.storageService.createDocumentSourceKey(
      documentId,
      input.file.originalname,
    );

    await this.storageService.uploadObject(
      sourceObjectKey,
      input.file.buffer,
      input.file.mimetype,
    );

    try {
      await this.documentsRepository.createDocumentWithMetadata({
        id: documentId,
        ownerId: input.ownerId,
        filename: input.file.originalname,
        requireTranslate: input.requireTranslate,
        requireVideoGeneration: input.requireVideoGeneration,
        status: INITIAL_DOCUMENT_STATUS,
        pipelineStage: INITIAL_PIPELINE_STAGE,
        sourceObjectKey,
        contentType: input.file.mimetype,
        fileSizeBytes: input.file.size,
      });

      await this.queueService.enqueueDocumentProcess({
        document_id: documentId,
        actor_id: input.ownerId,
        require_translate: input.requireTranslate,
        request_id: input.requestId ?? null,
      });
    } catch (error) {
      await Promise.all([
        this.documentsRepository.deleteOwnedDocument(documentId, input.ownerId),
        this.storageService.deleteObject(sourceObjectKey),
      ]);

      throw error;
    }

    const created = await this.documentsRepository.findOwnedDocumentById(
      documentId,
      input.ownerId,
    );

    if (!created) {
      throw new NotFoundException('Document was not created');
    }

    return {
      data: {
        id: created.id,
        filename: created.filename,
        status: created.status,
        pipeline_stage: created.pipeline_stage,
        require_translate: created.require_translate,
        require_video_generation: created.require_video_generation,
        source_lang: created.source_lang ?? 'unknown',
        page_count: created.page_count,
        created_at: created.created_at.toISOString(),
      },
    };
  }

  async getDocumentStatus(documentId: string, ownerId: string) {
    const document = await this.documentsRepository.findOwnedDocumentById(
      documentId,
      ownerId,
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const stageRuns = await this.documentsRepository.listStageRuns(documentId);

    return {
      data: {
        document_id: document.id,
        status: document.status,
        pipeline_stage: document.pipeline_stage,
        stages: stageRuns.map((stage) => ({
          name: stage.name,
          status: stage.status,
          progress_pct: stage.progress_pct,
          started_at: stage.started_at?.toISOString() ?? null,
          finished_at: stage.finished_at?.toISOString() ?? null,
        })),
        warnings: [],
      },
    };
  }

  streamDocumentStatus(
    documentId: string,
    ownerId: string,
  ): Observable<MessageEvent> {
    return interval(DOCUMENT_STATUS_STREAM_POLL_MS).pipe(
      startWith(0),
      switchMap(() => from(this.getDocumentStatus(documentId, ownerId))),
      map((payload) => ({
        type: DOCUMENT_STATUS_STREAM_EVENT,
        data: payload.data,
      })),
    );
  }

  async getPipelineProcessingContext(
    documentId: string,
  ): Promise<ProcessingDocumentContext> {
    const context =
      await this.documentsRepository.findDocumentProcessingContext(documentId);

    if (!context) {
      throw new NotFoundException('Document not found');
    }

    return context;
  }

  async getOwnedDocumentContext(documentId: string, ownerId: string) {
    const row = await this.documentsRepository.findOwnedDocumentById(
      documentId,
      ownerId,
    );

    if (!row) {
      throw new NotFoundException('Document not found');
    }

    return row;
  }

  async assertOwnedDocumentReady(documentId: string, ownerId: string) {
    const row = await this.getOwnedDocumentContext(documentId, ownerId);

    if (row.status !== 'ready') {
      throw new UnprocessableEntityException('Document not ready for video');
    }

    return row;
  }

  async setDocumentSourceLanguage(
    documentId: string,
    sourceLang: 'en' | 'id' | 'unknown',
  ): Promise<void> {
    await this.documentsRepository.setDocumentSourceLanguage(
      documentId,
      sourceLang,
    );
  }

  async startPipelineStage(
    documentId: string,
    stageName: string,
  ): Promise<void> {
    await this.documentsRepository.markDocumentStageInProgress(
      documentId,
      stageName,
    );
    await this.documentsRepository.upsertStageRun(
      documentId,
      stageName,
      'processing',
      10,
      new Date(),
      null,
    );
  }

  async completePipelineStage(
    documentId: string,
    stageName: string,
    pageCount: number | null,
  ): Promise<void> {
    await this.markPipelineStageDone(documentId, stageName);
    await this.documentsRepository.markDocumentReady(documentId, pageCount);
  }

  async markPipelineStageDone(
    documentId: string,
    stageName: string,
  ): Promise<void> {
    await this.documentsRepository.upsertStageRun(
      documentId,
      stageName,
      'done',
      100,
      null,
      new Date(),
    );
  }

  async failPipelineAttempt(
    documentId: string,
    stageName: string,
  ): Promise<void> {
    await this.documentsRepository.upsertStageRun(
      documentId,
      stageName,
      'error',
      null,
      null,
      new Date(),
    );
  }

  async failPipelineTerminal(
    documentId: string,
    stageName: string,
  ): Promise<void> {
    await this.failPipelineAttempt(documentId, stageName);
    await this.documentsRepository.markDocumentTerminalError(documentId);
  }

  private validateUploadFile(file?: UploadDocumentFile): void {
    if (!file) {
      throw new BadRequestException('Missing file');
    }

    if (file.size > this.maxUploadBytes) {
      throw new PayloadTooLargeException('File size exceeds limit');
    }

    const normalizedMime = file.mimetype.toLowerCase();
    if (normalizedMime !== 'application/pdf') {
      throw new BadRequestException('File must be a PDF');
    }

    const signature = file.buffer
      .subarray(0, PDF_MAGIC.length)
      .toString('utf8');
    if (signature !== PDF_MAGIC) {
      throw new BadRequestException('File must be a valid PDF');
    }
  }
}
