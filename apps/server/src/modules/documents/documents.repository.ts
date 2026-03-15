import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../infrastructure/database/database.service';
import type { DocumentStatus } from './documents.constants';

type DocumentRow = {
  id: string;
  owner_id: string;
  filename: string;
  status: string;
  pipeline_stage: string;
  require_translate: boolean;
  require_video_generation: boolean;
  source_lang: 'en' | 'id' | 'unknown' | null;
  page_count: number | null;
  title: string | null;
  abstract: string | null;
  pdf_type: string | null;
  ocr_quality: number | null;
  processed_at: Date | null;
  created_at: Date;
};

type DocumentMetadataRow = {
  document_id: string;
  source_object_key: string;
  content_type: string;
  file_size_bytes: string;
  created_at: Date;
};

type DocumentVideoSummaryRow = {
  job_id: string;
  status: string;
  pipeline_stage: string;
  progress_pct: number;
  final_video_object_key: string | null;
  final_thumbnail_object_key: string | null;
  bunny_library_id: string | null;
  bunny_video_id: string | null;
  bunny_status: number | null;
  completed_at: Date | null;
};

type StageRunRow = {
  id: string;
  document_id: string;
  name: string;
  status: string;
  progress_pct: number | null;
  started_at: Date | null;
  finished_at: Date | null;
};

export type ProcessingDocumentContext = {
  id: string;
  owner_id: string;
  filename: string;
  status: string;
  pipeline_stage: string;
  require_translate: boolean;
  require_video_generation: boolean;
  source_lang: 'en' | 'id' | 'unknown' | null;
  source_object_key: string;
};

export type CreateDocumentInput = {
  id: string;
  ownerId: string;
  filename: string;
  requireTranslate: boolean;
  requireVideoGeneration: boolean;
  status: DocumentStatus;
  pipelineStage: string;
  sourceObjectKey: string;
  contentType: string;
  fileSizeBytes: number;
};

export type DocumentsListInput = {
  ownerId: string;
  page: number;
  limit: number;
  status?: DocumentStatus;
};

@Injectable()
export class DocumentsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createDocumentWithMetadata(input: CreateDocumentInput): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO documents (
          id,
          owner_id,
          filename,
          status,
          pipeline_stage,
          require_translate,
          require_video_generation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          input.id,
          input.ownerId,
          input.filename,
          input.status,
          input.pipelineStage,
          input.requireTranslate,
          input.requireVideoGeneration,
        ],
      );

      await client.query(
        `
        INSERT INTO document_metadata (
          document_id,
          source_object_key,
          content_type,
          file_size_bytes
        ) VALUES ($1, $2, $3, $4)
        `,
        [
          input.id,
          input.sourceObjectKey,
          input.contentType,
          input.fileSizeBytes,
        ],
      );
    });
  }

  async deleteOwnedDocument(
    documentId: string,
    ownerId: string,
  ): Promise<boolean> {
    const result = await this.databaseService.query<{ id: string }>(
      `
      DELETE FROM documents
      WHERE id = $1 AND owner_id = $2
      RETURNING id
      `,
      [documentId, ownerId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async findOwnedDocumentById(
    documentId: string,
    ownerId: string,
  ): Promise<DocumentRow | null> {
    const result = await this.databaseService.query<DocumentRow>(
      `
      SELECT
        id,
        owner_id,
        filename,
        status,
        pipeline_stage,
        require_translate,
        require_video_generation,
        source_lang,
        page_count,
        title,
        abstract,
        pdf_type,
        ocr_quality,
        processed_at,
        created_at
      FROM documents
      WHERE id = $1 AND owner_id = $2
      LIMIT 1
      `,
      [documentId, ownerId],
    );

    return result.rows[0] ?? null;
  }

  async listOwnedDocuments(input: DocumentsListInput): Promise<{
    rows: DocumentRow[];
    total: number;
  }> {
    const offset = (input.page - 1) * input.limit;

    const listResult = await this.databaseService.query<DocumentRow>(
      `
      SELECT
        id,
        owner_id,
        filename,
        status,
        pipeline_stage,
        require_translate,
        require_video_generation,
        source_lang,
        page_count,
        title,
        abstract,
        pdf_type,
        ocr_quality,
        processed_at,
        created_at
      FROM documents
      WHERE owner_id = $1
        AND ($2::text IS NULL OR status = $2)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
      `,
      [input.ownerId, input.status ?? null, input.limit, offset],
    );

    const countResult = await this.databaseService.query<{ total: string }>(
      `
      SELECT COUNT(*)::text AS total
      FROM documents
      WHERE owner_id = $1
        AND ($2::text IS NULL OR status = $2)
      `,
      [input.ownerId, input.status ?? null],
    );

    return {
      rows: listResult.rows,
      total: Number.parseInt(countResult.rows[0]?.total ?? '0', 10),
    };
  }

  async findDocumentMetadata(
    documentId: string,
  ): Promise<DocumentMetadataRow | null> {
    const result = await this.databaseService.query<DocumentMetadataRow>(
      `
      SELECT
        document_id,
        source_object_key,
        content_type,
        file_size_bytes,
        created_at
      FROM document_metadata
      WHERE document_id = $1
      LIMIT 1
      `,
      [documentId],
    );

    return result.rows[0] ?? null;
  }

  async listStageRuns(documentId: string): Promise<StageRunRow[]> {
    const result = await this.databaseService.query<StageRunRow>(
      `
      SELECT
        id,
        document_id,
        name,
        status,
        progress_pct,
        started_at,
        finished_at
      FROM stage_runs
      WHERE document_id = $1
      ORDER BY created_at ASC
      `,
      [documentId],
    );

    return result.rows;
  }

  async findOwnedDocumentVideoSummary(
    documentId: string,
    ownerId: string,
  ): Promise<DocumentVideoSummaryRow | null> {
    const result = await this.databaseService.query<DocumentVideoSummaryRow>(
      `
      SELECT
        vj.id AS job_id,
        vj.status,
        vj.pipeline_stage,
        vj.progress_pct,
        vj.final_video_object_key,
        vj.final_thumbnail_object_key,
        vj.bunny_library_id,
        vj.bunny_video_id,
        vj.bunny_status,
        vj.completed_at
      FROM video_jobs vj
      WHERE vj.document_id = $1
        AND vj.owner_id = $2
      ORDER BY
        CASE WHEN vj.status = 'completed' THEN 0 ELSE 1 END,
        COALESCE(vj.completed_at, vj.created_at) DESC,
        vj.created_at DESC
      LIMIT 1
      `,
      [documentId, ownerId],
    );

    return result.rows[0] ?? null;
  }

  async findDocumentProcessingContext(
    documentId: string,
  ): Promise<ProcessingDocumentContext | null> {
    const result = await this.databaseService.query<ProcessingDocumentContext>(
      `
      SELECT
        d.id,
        d.owner_id,
        d.filename,
        d.status,
        d.pipeline_stage,
        d.require_translate,
        d.require_video_generation,
        d.source_lang,
        dm.source_object_key
      FROM documents d
      JOIN document_metadata dm ON dm.document_id = d.id
      WHERE d.id = $1
      LIMIT 1
      `,
      [documentId],
    );

    return result.rows[0] ?? null;
  }

  async upsertStageRun(
    documentId: string,
    stageName: string,
    status: 'processing' | 'done' | 'error',
    progressPct: number | null,
    startedAt: Date | null,
    finishedAt: Date | null,
  ): Promise<void> {
    await this.databaseService.query(
      `
      INSERT INTO stage_runs (
        id,
        document_id,
        name,
        status,
        progress_pct,
        started_at,
        finished_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (document_id, name)
      DO UPDATE SET
        status = EXCLUDED.status,
        progress_pct = EXCLUDED.progress_pct,
        started_at = COALESCE(stage_runs.started_at, EXCLUDED.started_at),
        finished_at = EXCLUDED.finished_at,
        updated_at = now()
      `,
      [
        randomUUID(),
        documentId,
        stageName,
        status,
        progressPct,
        startedAt,
        finishedAt,
      ],
    );
  }

  async markDocumentStageInProgress(
    documentId: string,
    pipelineStage: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE documents
      SET
        status = 'processing',
        pipeline_stage = $2,
        updated_at = now()
      WHERE id = $1
        AND status <> 'ready'
      `,
      [documentId, pipelineStage],
    );
  }

  async markDocumentReady(
    documentId: string,
    pageCount: number | null,
  ): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE documents
      SET
        status = 'ready',
        pipeline_stage = 'completed',
        page_count = COALESCE($2, page_count),
        processed_at = COALESCE(processed_at, now()),
        updated_at = now()
      WHERE id = $1
      `,
      [documentId, pageCount],
    );
  }

  async setDocumentSourceLanguage(
    documentId: string,
    sourceLang: 'en' | 'id' | 'unknown',
  ): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE documents
      SET
        source_lang = $2,
        updated_at = now()
      WHERE id = $1
      `,
      [documentId, sourceLang],
    );
  }

  async markDocumentTerminalError(documentId: string): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE documents
      SET
        status = 'error',
        pipeline_stage = 'failed',
        updated_at = now()
      WHERE id = $1
        AND status <> 'ready'
      `,
      [documentId],
    );
  }
}
