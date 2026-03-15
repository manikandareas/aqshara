import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import type {
  ReaderArtifactsBundle,
  ReaderMapNodeRecord,
  ReaderParagraphRecord,
  ReaderSectionRecord,
  ReaderTermOccurrenceRecord,
  ReaderTermRecord,
  ReaderTranslationRecord,
  ReaderWarningRecord,
  TranslationRetryContext,
} from './reader.types';

@Injectable()
export class ReaderRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async replaceDocumentArtifacts(
    documentId: string,
    artifacts: ReaderArtifactsBundle,
  ): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      await this.clearDocumentArtifactsInTx(client, documentId);
      await this.insertSections(client, documentId, artifacts.sections);
      await this.insertParagraphs(client, documentId, artifacts.paragraphs);
      await this.insertParagraphTranslations(
        client,
        documentId,
        artifacts.translations,
      );
      await this.insertTerms(client, documentId, artifacts.terms);
      await this.insertTermOccurrences(client, artifacts.term_occurrences);
      await this.insertMapNodes(client, documentId, artifacts.map_nodes);
      await this.insertWarnings(client, documentId, artifacts.warnings);
    });
  }

  async listOutlineSections(
    documentId: string,
  ): Promise<ReaderSectionRecord[]> {
    const result = await this.databaseService.query<ReaderSectionRecord>(
      `
      SELECT
        id,
        parent_id,
        level,
        title,
        title_id,
        para_start,
        order_no
      FROM sections
      WHERE document_id = $1
      ORDER BY order_no ASC
      `,
      [documentId],
    );

    return result.rows;
  }

  async listParagraphs(
    documentId: string,
    page: number,
    limit: number,
    sectionId?: string,
  ): Promise<ReaderParagraphRecord[]> {
    const offset = (page - 1) * limit;
    const result = await this.databaseService.query<ReaderParagraphRecord>(
      `
      SELECT
        p.id,
        p.section_id,
        p.order_no,
        p.page_no,
        p.source_start,
        p.source_end,
        p.text_raw,
        p.text_raw_md,
        d.source_lang,
        pt.text_en,
        pt.text_en_md,
        pt.text_id,
        pt.text_id_md,
        pt.status AS translation_status
      FROM paragraphs p
      JOIN documents d ON d.id = p.document_id
      LEFT JOIN paragraph_translations pt ON pt.paragraph_id = p.id
      WHERE p.document_id = $1
        AND ($2::text IS NULL OR p.section_id = $2)
      ORDER BY p.order_no ASC
      LIMIT $3 OFFSET $4
      `,
      [documentId, sectionId ?? null, limit, offset],
    );

    return result.rows;
  }

  async countParagraphs(
    documentId: string,
    sectionId?: string,
  ): Promise<number> {
    const result = await this.databaseService.query<{ total: string }>(
      `
      SELECT COUNT(*)::text AS total
      FROM paragraphs
      WHERE document_id = $1
        AND ($2::text IS NULL OR section_id = $2)
      `,
      [documentId, sectionId ?? null],
    );

    return Number.parseInt(result.rows[0]?.total ?? '0', 10);
  }

  async listParagraphIds(documentId: string): Promise<string[]> {
    const result = await this.databaseService.query<{ id: string }>(
      `
      SELECT id
      FROM paragraphs
      WHERE document_id = $1
      ORDER BY order_no ASC
      `,
      [documentId],
    );

    return result.rows.map((row) => row.id);
  }

  async findParagraphById(
    documentId: string,
    paragraphId: string,
  ): Promise<ReaderParagraphRecord | null> {
    const result = await this.databaseService.query<ReaderParagraphRecord>(
      `
      SELECT
        p.id,
        p.section_id,
        p.order_no,
        p.page_no,
        p.source_start,
        p.source_end,
        p.text_raw,
        p.text_raw_md,
        d.source_lang,
        pt.text_en,
        pt.text_en_md,
        pt.text_id,
        pt.text_id_md,
        pt.status AS translation_status
      FROM paragraphs p
      JOIN documents d ON d.id = p.document_id
      LEFT JOIN paragraph_translations pt ON pt.paragraph_id = p.id
      WHERE p.document_id = $1
        AND p.id = $2
      LIMIT 1
      `,
      [documentId, paragraphId],
    );

    return result.rows[0] ?? null;
  }

  async searchParagraphs(
    documentId: string,
    q: string,
    lang: 'en' | 'id',
  ): Promise<
    Array<{
      paragraph_id: string;
      section_id: string | null;
      page_no: number;
      lang: string;
      snippet: string;
    }>
  > {
    const pattern = `%${q}%`;

    const result = await this.databaseService.query<{
      paragraph_id: string;
      section_id: string | null;
      page_no: number;
      lang: string;
      snippet: string;
    }>(
      `
      SELECT
        p.id AS paragraph_id,
        p.section_id,
        p.page_no,
        $3::text AS lang,
        CASE
          WHEN $3::text = 'id' THEN
            CASE
              WHEN COALESCE(d.source_lang, 'unknown') = 'id' THEN p.text_raw
              ELSE COALESCE(pt.text_id, '')
            END
          ELSE
            CASE
              WHEN COALESCE(d.source_lang, 'unknown') = 'en' THEN p.text_raw
              ELSE COALESCE(pt.text_en, '')
            END
        END AS snippet
      FROM paragraphs p
      JOIN documents d ON d.id = p.document_id
      LEFT JOIN paragraph_translations pt ON pt.paragraph_id = p.id
      WHERE p.document_id = $1
        AND (
          CASE
            WHEN $3::text = 'id' THEN
              CASE
                WHEN COALESCE(d.source_lang, 'unknown') = 'id' THEN p.text_raw
                ELSE COALESCE(pt.text_id, '')
              END
            ELSE
              CASE
                WHEN COALESCE(d.source_lang, 'unknown') = 'en' THEN p.text_raw
                ELSE COALESCE(pt.text_en, '')
              END
          END
        ) ILIKE $2
      ORDER BY p.order_no ASC
      LIMIT 200
      `,
      [documentId, pattern, lang],
    );

    return result.rows;
  }

  async listTranslations(
    documentId: string,
    page: number,
    limit: number,
    status?: 'pending' | 'done' | 'error',
  ): Promise<ReaderTranslationRecord[]> {
    const offset = (page - 1) * limit;
    const result = await this.databaseService.query<ReaderTranslationRecord>(
      `
      SELECT
        pt.paragraph_id,
        pt.text_en,
        pt.text_en_md,
        pt.text_id,
        pt.text_id_md,
        pt.status,
        pt.translated_at,
        pt.cache_hash
      FROM paragraph_translations pt
      WHERE pt.document_id = $1
        AND ($2::text IS NULL OR pt.status = $2)
      ORDER BY pt.paragraph_id ASC
      LIMIT $3 OFFSET $4
      `,
      [documentId, status ?? null, limit, offset],
    );

    return result.rows;
  }

  async countTranslations(
    documentId: string,
    status?: 'pending' | 'done' | 'error',
  ): Promise<number> {
    const result = await this.databaseService.query<{ total: string }>(
      `
      SELECT COUNT(*)::text AS total
      FROM paragraph_translations
      WHERE document_id = $1
        AND ($2::text IS NULL OR status = $2)
      `,
      [documentId, status ?? null],
    );

    return Number.parseInt(result.rows[0]?.total ?? '0', 10);
  }

  async listGlossaryTerms(
    documentId: string,
    page: number,
    limit: number,
    sort: 'frequency' | 'alphabetical',
  ): Promise<ReaderTermRecord[]> {
    const offset = (page - 1) * limit;
    const orderSql =
      sort === 'alphabetical'
        ? 'ORDER BY t.term_en ASC'
        : 'ORDER BY t.occurrence_count DESC, t.term_en ASC';

    const result = await this.databaseService.query<ReaderTermRecord>(
      `
      SELECT
        t.id,
        t.term_en,
        t.definition,
        t.definition_id,
        t.example,
        t.example_id,
        t.occurrence_count
      FROM terms t
      WHERE t.document_id = $1
      ${orderSql}
      LIMIT $2 OFFSET $3
      `,
      [documentId, limit, offset],
    );

    return result.rows;
  }

  async countGlossaryTerms(documentId: string): Promise<number> {
    const result = await this.databaseService.query<{ total: string }>(
      `
      SELECT COUNT(*)::text AS total
      FROM terms
      WHERE document_id = $1
      `,
      [documentId],
    );

    return Number.parseInt(result.rows[0]?.total ?? '0', 10);
  }

  async findGlossaryTerm(
    documentId: string,
    termId: string,
  ): Promise<ReaderTermRecord | null> {
    const result = await this.databaseService.query<ReaderTermRecord>(
      `
      SELECT
        id,
        term_en,
        definition,
        definition_id,
        example,
        example_id,
        occurrence_count
      FROM terms
      WHERE document_id = $1
        AND id = $2
      LIMIT 1
      `,
      [documentId, termId],
    );

    return result.rows[0] ?? null;
  }

  async listGlossaryOccurrences(
    termId: string,
  ): Promise<ReaderTermOccurrenceRecord[]> {
    const result = await this.databaseService.query<ReaderTermOccurrenceRecord>(
      `
      SELECT
        paragraph_id,
        page_no,
        snippet_en
      FROM term_occurrences
      WHERE term_id = $1
      ORDER BY page_no ASC
      `,
      [termId],
    );

    return result.rows;
  }

  async lookupGlossaryTerm(
    documentId: string,
    term: string,
    lang: 'en' | 'id',
  ): Promise<ReaderTermRecord | null> {
    const result = await this.databaseService.query<ReaderTermRecord>(
      `
      SELECT
        id,
        term_en,
        definition,
        definition_id,
        example,
        example_id,
        occurrence_count
      FROM terms
      WHERE document_id = $1
        AND (
          ($3::text = 'en' AND LOWER(term_en) = LOWER($2))
          OR ($3::text = 'id' AND LOWER(COALESCE(definition_id, '')) = LOWER($2))
        )
      ORDER BY occurrence_count DESC, term_en ASC
      LIMIT 1
      `,
      [documentId, term, lang],
    );

    return result.rows[0] ?? null;
  }

  async listMapNodes(documentId: string): Promise<ReaderMapNodeRecord[]> {
    const result = await this.databaseService.query<ReaderMapNodeRecord>(
      `
      SELECT
        id,
        parent_id,
        label,
        label_id,
        type,
        para_refs,
        order_no
      FROM map_nodes
      WHERE document_id = $1
      ORDER BY order_no ASC
      `,
      [documentId],
    );

    return result.rows;
  }

  async findMapNode(
    documentId: string,
    nodeId: string,
  ): Promise<ReaderMapNodeRecord | null> {
    const result = await this.databaseService.query<ReaderMapNodeRecord>(
      `
      SELECT
        id,
        parent_id,
        label,
        label_id,
        type,
        para_refs,
        order_no
      FROM map_nodes
      WHERE document_id = $1
        AND id = $2
      LIMIT 1
      `,
      [documentId, nodeId],
    );

    return result.rows[0] ?? null;
  }

  async listWarnings(documentId: string): Promise<ReaderWarningRecord[]> {
    const result = await this.databaseService.query<ReaderWarningRecord>(
      `
      SELECT code, message, pages
      FROM warnings
      WHERE document_id = $1
      ORDER BY created_at ASC
      `,
      [documentId],
    );

    return result.rows;
  }

  async markTranslationPending(
    documentId: string,
    paragraphId: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
      INSERT INTO paragraph_translations (
        paragraph_id,
        document_id,
        status,
        text_en,
        text_en_md,
        text_id,
        text_id_md,
        cache_hash,
        translated_at
      ) VALUES ($1, $2, 'pending', NULL, NULL, NULL, NULL, NULL, NULL)
      ON CONFLICT (paragraph_id)
      DO UPDATE SET
        status = 'pending',
        text_en = NULL,
        text_en_md = NULL,
        text_id = NULL,
        text_id_md = NULL,
        cache_hash = NULL,
        translated_at = NULL,
        updated_at = now()
      `,
      [paragraphId, documentId],
    );
  }

  async getTranslationRetryContext(
    documentId: string,
    paragraphId: string,
  ): Promise<TranslationRetryContext | null> {
    const result = await this.databaseService.query<TranslationRetryContext>(
      `
      SELECT
        p.id AS paragraph_id,
        p.text_raw,
        p.text_raw_md,
        d.source_lang,
        pt.status
      FROM paragraphs p
      JOIN documents d ON d.id = p.document_id
      LEFT JOIN paragraph_translations pt ON pt.paragraph_id = p.id
      WHERE p.document_id = $1
        AND p.id = $2
      LIMIT 1
      `,
      [documentId, paragraphId],
    );

    return result.rows[0] ?? null;
  }

  async markTranslationDone(
    documentId: string,
    paragraphId: string,
    payload: {
      textEn: string | null;
      textEnMd: string | null;
      textId: string | null;
      textIdMd: string | null;
      cacheHash: string;
      translatedAt: Date;
    },
  ): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE paragraph_translations
      SET
        document_id = $1,
        status = 'done',
        text_en = $3,
        text_en_md = $4,
        text_id = $5,
        text_id_md = $6,
        cache_hash = $7,
        translated_at = $8,
        updated_at = now()
      WHERE paragraph_id = $2
      `,
      [
        documentId,
        paragraphId,
        payload.textEn,
        payload.textEnMd,
        payload.textId,
        payload.textIdMd,
        payload.cacheHash,
        payload.translatedAt,
      ],
    );
  }

  async markTranslationError(
    documentId: string,
    paragraphId: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
      INSERT INTO paragraph_translations (
        paragraph_id,
        document_id,
        status,
        text_en,
        text_en_md,
        text_id,
        text_id_md,
        cache_hash,
        translated_at
      ) VALUES ($1, $2, 'error', NULL, NULL, NULL, NULL, NULL, NULL)
      ON CONFLICT (paragraph_id)
      DO UPDATE SET
        status = 'error',
        text_en = NULL,
        text_en_md = NULL,
        text_id = NULL,
        text_id_md = NULL,
        cache_hash = NULL,
        translated_at = NULL,
        updated_at = now()
      `,
      [paragraphId, documentId],
    );
  }

  private async clearDocumentArtifactsInTx(
    client: PoolClient,
    documentId: string,
  ): Promise<void> {
    await client.query(
      `
      DELETE FROM term_occurrences
      WHERE term_id IN (
        SELECT id FROM terms WHERE document_id = $1
      )
      `,
      [documentId],
    );
    await client.query('DELETE FROM warnings WHERE document_id = $1', [
      documentId,
    ]);
    await client.query('DELETE FROM map_nodes WHERE document_id = $1', [
      documentId,
    ]);
    await client.query(
      'DELETE FROM paragraph_translations WHERE document_id = $1',
      [documentId],
    );
    await client.query('DELETE FROM paragraphs WHERE document_id = $1', [
      documentId,
    ]);
    await client.query('DELETE FROM sections WHERE document_id = $1', [
      documentId,
    ]);
    await client.query('DELETE FROM terms WHERE document_id = $1', [
      documentId,
    ]);
  }

  private async insertSections(
    client: PoolClient,
    documentId: string,
    rows: ReaderArtifactsBundle['sections'],
  ): Promise<void> {
    for (const row of rows) {
      await client.query(
        `
        INSERT INTO sections (
          id,
          document_id,
          parent_id,
          level,
          title,
          title_id,
          para_start,
          order_no
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          row.id,
          documentId,
          row.parent_id,
          row.level,
          row.title,
          row.title_id,
          row.para_start,
          row.order_no,
        ],
      );
    }
  }

  private async insertParagraphs(
    client: PoolClient,
    documentId: string,
    rows: ReaderArtifactsBundle['paragraphs'],
  ): Promise<void> {
    for (const row of rows) {
      await client.query(
        `
        INSERT INTO paragraphs (
          id,
          document_id,
          section_id,
          order_no,
          page_no,
          source_start,
          source_end,
          text_raw,
          text_raw_md
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          row.id,
          documentId,
          row.section_id,
          row.order_no,
          row.page_no,
          row.source_start,
          row.source_end,
          row.text_raw,
          row.text_raw_md,
        ],
      );
    }
  }

  private async insertParagraphTranslations(
    client: PoolClient,
    documentId: string,
    rows: ReaderArtifactsBundle['translations'],
  ): Promise<void> {
    for (const row of rows) {
      await client.query(
        `
        INSERT INTO paragraph_translations (
          paragraph_id,
          document_id,
          status,
          text_en,
          text_en_md,
          text_id,
          text_id_md,
          cache_hash,
          translated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          row.paragraph_id,
          documentId,
          row.status,
          row.text_en,
          row.text_en_md,
          row.text_id,
          row.text_id_md,
          row.cache_hash,
          row.translated_at,
        ],
      );
    }
  }

  private async insertTerms(
    client: PoolClient,
    documentId: string,
    rows: ReaderArtifactsBundle['terms'],
  ): Promise<void> {
    for (const row of rows) {
      await client.query(
        `
        INSERT INTO terms (
          id,
          document_id,
          term_en,
          definition,
          definition_id,
          example,
          example_id,
          occurrence_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          row.id,
          documentId,
          row.term_en,
          row.definition,
          row.definition_id,
          row.example,
          row.example_id,
          row.occurrence_count,
        ],
      );
    }
  }

  private async insertTermOccurrences(
    client: PoolClient,
    rows: ReaderArtifactsBundle['term_occurrences'],
  ): Promise<void> {
    for (const row of rows) {
      await client.query(
        `
        INSERT INTO term_occurrences (
          id,
          term_id,
          paragraph_id,
          page_no,
          snippet_en
        ) VALUES ($1, $2, $3, $4, $5)
        `,
        [
          row.id || randomUUID(),
          row.term_id,
          row.paragraph_id,
          row.page_no,
          row.snippet_en,
        ],
      );
    }
  }

  private async insertMapNodes(
    client: PoolClient,
    documentId: string,
    rows: ReaderArtifactsBundle['map_nodes'],
  ): Promise<void> {
    for (const row of rows) {
      await client.query(
        `
        INSERT INTO map_nodes (
          id,
          document_id,
          parent_id,
          label,
          label_id,
          type,
          para_refs,
          order_no
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          row.id,
          documentId,
          row.parent_id,
          row.label,
          row.label_id,
          row.type,
          row.para_refs,
          row.order_no,
        ],
      );
    }
  }

  private async insertWarnings(
    client: PoolClient,
    documentId: string,
    rows: ReaderArtifactsBundle['warnings'],
  ): Promise<void> {
    for (const row of rows) {
      await client.query(
        `
        INSERT INTO warnings (
          id,
          document_id,
          code,
          message,
          pages
        ) VALUES ($1, $2, $3, $4, $5)
        `,
        [row.id, documentId, row.code, row.message, row.pages],
      );
    }
  }
}
