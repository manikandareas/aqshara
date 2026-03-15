import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { DocumentsRepository } from '../documents/documents.repository';
import { ReaderArtifactBuilder } from './reader-artifact.builder';
import { ReaderRepository } from './reader.repository';
import type {
  ReaderMapNodeRecord,
  ReaderParagraphRecord,
  ReaderSectionRecord,
} from './reader.types';

type OwnedReadyDocument = {
  id: string;
  require_translate: boolean;
};

@Injectable()
export class ReaderService {
  constructor(
    private readonly readerRepository: ReaderRepository,
    private readonly documentsRepository: DocumentsRepository,
    private readonly queueService: QueueService,
    private readonly readerArtifactBuilder: ReaderArtifactBuilder,
  ) {}

  async rebuildArtifactsFromOcrResult(
    documentId: string,
    ocrResult: unknown,
    requireTranslate: boolean,
    sourceLang: 'en' | 'id' | 'unknown',
  ): Promise<void> {
    const artifacts = await this.readerArtifactBuilder.buildFromOcrResult(
      documentId,
      ocrResult,
      requireTranslate,
      sourceLang,
    );

    await this.readerRepository.replaceDocumentArtifacts(documentId, artifacts);
  }

  async enqueueInitialTranslationJobs(input: {
    documentId: string;
    actorId: string;
    requestId?: string;
  }): Promise<void> {
    const paragraphIds = await this.readerRepository.listParagraphIds(
      input.documentId,
    );

    await Promise.all(
      paragraphIds.map((paragraphId) =>
        this.queueService.enqueueTranslationRetry({
          document_id: input.documentId,
          paragraph_id: paragraphId,
          actor_id: input.actorId,
          request_id: input.requestId ?? null,
        }),
      ),
    );
  }

  async getOutline(documentId: string, ownerId: string) {
    await this.assertOwnedReadyDocument(documentId, ownerId);
    const rows = await this.readerRepository.listOutlineSections(documentId);

    return {
      data: {
        sections: this.buildOutlineTree(rows),
      },
    };
  }

  async listParagraphs(input: {
    documentId: string;
    ownerId: string;
    sectionId?: string;
    page: number;
    limit: number;
  }) {
    await this.assertOwnedReadyDocument(input.documentId, input.ownerId);

    const [rows, total] = await Promise.all([
      this.readerRepository.listParagraphs(
        input.documentId,
        input.page,
        input.limit,
        input.sectionId,
      ),
      this.readerRepository.countParagraphs(input.documentId, input.sectionId),
    ]);

    return {
      data: rows.map((row) => this.mapParagraphRow(row)),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
      },
    };
  }

  async getParagraphDetail(
    documentId: string,
    paragraphId: string,
    ownerId: string,
  ) {
    await this.assertOwnedReadyDocument(documentId, ownerId);
    const row = await this.readerRepository.findParagraphById(
      documentId,
      paragraphId,
    );

    if (!row) {
      throw new NotFoundException('Paragraph not found');
    }

    return {
      data: this.mapParagraphRow(row),
    };
  }

  async searchParagraphs(
    documentId: string,
    ownerId: string,
    q: string,
    lang: 'en' | 'id',
  ) {
    await this.assertOwnedReadyDocument(documentId, ownerId);

    const rows = await this.readerRepository.searchParagraphs(
      documentId,
      q.trim(),
      lang,
    );

    return {
      data: {
        query: q.trim(),
        total: rows.length,
        hits: rows,
      },
    };
  }

  async listTranslations(input: {
    documentId: string;
    ownerId: string;
    page: number;
    limit: number;
    status?: 'pending' | 'done' | 'error';
  }) {
    const document = await this.assertOwnedReadyDocument(
      input.documentId,
      input.ownerId,
    );

    const [rows, total] = await Promise.all([
      this.readerRepository.listTranslations(
        input.documentId,
        input.page,
        input.limit,
        input.status,
      ),
      this.readerRepository.countTranslations(input.documentId, input.status),
    ]);

    return {
      data: rows.map((row) => ({
        paragraph_id: row.paragraph_id,
        text_en: row.text_en ?? '',
        text_en_md: row.text_en_md ?? '',
        text_id: row.text_id ?? '',
        text_id_md: row.text_id_md ?? '',
        status: row.status,
        translated_at: row.translated_at?.toISOString() ?? null,
        cache_hash: row.cache_hash ?? '',
      })),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
      },
      translation_enabled: document.require_translate,
    };
  }

  async listGlossary(input: {
    documentId: string;
    ownerId: string;
    page: number;
    limit: number;
    sort: 'frequency' | 'alphabetical';
  }) {
    await this.assertOwnedReadyDocument(input.documentId, input.ownerId);

    const [rows, total] = await Promise.all([
      this.readerRepository.listGlossaryTerms(
        input.documentId,
        input.page,
        input.limit,
        input.sort,
      ),
      this.readerRepository.countGlossaryTerms(input.documentId),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        term_en: row.term_en,
        term_id: row.id,
        definition: row.definition ?? '',
        definition_id: row.definition_id ?? '',
        example: row.example ?? '',
        example_id: row.example_id ?? '',
        occurrence_count: row.occurrence_count,
        occurrences: [],
      })),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
      },
    };
  }

  async getGlossaryTerm(documentId: string, termId: string, ownerId: string) {
    await this.assertOwnedReadyDocument(documentId, ownerId);

    const term = await this.readerRepository.findGlossaryTerm(
      documentId,
      termId,
    );
    if (!term) {
      throw new NotFoundException('Glossary term not found');
    }

    const occurrences =
      await this.readerRepository.listGlossaryOccurrences(termId);

    return {
      data: {
        id: term.id,
        term_en: term.term_en,
        term_id: term.id,
        definition: term.definition ?? '',
        definition_id: term.definition_id ?? '',
        example: term.example ?? '',
        example_id: term.example_id ?? '',
        occurrence_count: term.occurrence_count,
        occurrences,
      },
    };
  }

  async lookupGlossaryTerm(input: {
    documentId: string;
    ownerId: string;
    term: string;
    lang: 'en' | 'id';
  }) {
    await this.assertOwnedReadyDocument(input.documentId, input.ownerId);

    const found = await this.readerRepository.lookupGlossaryTerm(
      input.documentId,
      input.term.trim(),
      input.lang,
    );

    if (!found) {
      throw new NotFoundException('Glossary term not found');
    }

    return {
      data: {
        id: found.id,
        term_en: found.term_en,
        term_id: found.id,
        definition_id: found.definition_id ?? '',
        example_id: found.example_id ?? '',
      },
    };
  }

  async getMapTree(documentId: string, ownerId: string) {
    await this.assertOwnedReadyDocument(documentId, ownerId);

    const nodes = await this.readerRepository.listMapNodes(documentId);

    return {
      data: {
        nodes: this.buildMapTree(nodes),
      },
    };
  }

  async getMapNodeDetail(documentId: string, nodeId: string, ownerId: string) {
    await this.assertOwnedReadyDocument(documentId, ownerId);

    const node = await this.readerRepository.findMapNode(documentId, nodeId);
    if (!node) {
      throw new NotFoundException('Map node not found');
    }

    const sourceParagraphs = await this.getSourceParagraphsForMapNode(
      documentId,
      node.para_refs,
    );

    return {
      data: {
        id: node.id,
        label: node.label,
        label_id: node.label_id ?? '',
        type: node.type,
        para_refs: node.para_refs ?? [],
        source_paragraphs: sourceParagraphs,
      },
    };
  }

  async enqueueTranslationRetry(input: {
    documentId: string;
    paragraphId: string;
    ownerId: string;
    requestId?: string;
  }) {
    const document = await this.assertOwnedReadyDocument(
      input.documentId,
      input.ownerId,
    );

    if (!document.require_translate) {
      throw new UnprocessableEntityException(
        'Translation is not enabled for this document',
      );
    }

    const context = await this.readerRepository.getTranslationRetryContext(
      input.documentId,
      input.paragraphId,
    );

    if (!context) {
      throw new NotFoundException('Paragraph not found');
    }

    await this.readerRepository.markTranslationPending(
      input.documentId,
      input.paragraphId,
    );

    try {
      await this.queueService.enqueueTranslationRetry({
        document_id: input.documentId,
        paragraph_id: input.paragraphId,
        actor_id: input.ownerId,
        request_id: input.requestId ?? null,
      });
    } catch (error) {
      await this.readerRepository.markTranslationError(
        input.documentId,
        input.paragraphId,
      );
      throw error;
    }

    return {
      data: {
        paragraph_id: input.paragraphId,
        status: 'pending',
      },
    };
  }

  async getTranslationRetryContext(
    documentId: string,
    paragraphId: string,
  ): Promise<{
    paragraphId: string;
    textRaw: string;
    textRawMd: string;
    sourceLang: 'en' | 'id' | 'unknown';
  }> {
    const context = await this.readerRepository.getTranslationRetryContext(
      documentId,
      paragraphId,
    );

    if (!context) {
      throw new NotFoundException('Paragraph not found');
    }

    return {
      paragraphId: context.paragraph_id,
      textRaw: context.text_raw,
      textRawMd: context.text_raw_md,
      sourceLang: context.source_lang ?? 'unknown',
    };
  }

  async completeTranslationRetry(
    documentId: string,
    paragraphId: string,
    payload: {
      textEn: string | null;
      textEnMd: string | null;
      textId: string | null;
      textIdMd: string | null;
    },
  ): Promise<void> {
    const cacheHash = createHash('sha256')
      .update(
        `${payload.textEn ?? ''}|${payload.textEnMd ?? ''}|${payload.textId ?? ''}|${payload.textIdMd ?? ''}`,
      )
      .digest('hex');

    await this.readerRepository.markTranslationDone(documentId, paragraphId, {
      textEn: payload.textEn,
      textEnMd: payload.textEnMd,
      textId: payload.textId,
      textIdMd: payload.textIdMd,
      cacheHash,
      translatedAt: new Date(),
    });
  }

  async failTranslationRetry(
    documentId: string,
    paragraphId: string,
  ): Promise<void> {
    await this.readerRepository.markTranslationError(documentId, paragraphId);
  }

  private async assertOwnedReadyDocument(
    documentId: string,
    ownerId: string,
  ): Promise<OwnedReadyDocument> {
    const document = await this.documentsRepository.findOwnedDocumentById(
      documentId,
      ownerId,
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status !== 'ready') {
      throw new UnprocessableEntityException(
        'Document is not ready for reader queries',
      );
    }

    return {
      id: document.id,
      require_translate: document.require_translate,
    };
  }

  private mapParagraphRow(row: ReaderParagraphRecord) {
    const sourceLang = row.source_lang ?? 'unknown';
    const textEn = sourceLang === 'en' ? row.text_raw : (row.text_en ?? '');
    const textEnMd =
      sourceLang === 'en' ? row.text_raw_md : (row.text_en_md ?? '');
    const textId = sourceLang === 'id' ? row.text_raw : (row.text_id ?? '');
    const textIdMd =
      sourceLang === 'id' ? row.text_raw_md : (row.text_id_md ?? '');

    return {
      id: row.id,
      section_id: row.section_id,
      order: row.order_no,
      page_no: row.page_no,
      source_span:
        row.source_start !== null && row.source_end !== null
          ? [row.source_start, row.source_end]
          : [],
      text_raw: row.text_raw,
      text_raw_md: row.text_raw_md,
      source_lang: sourceLang,
      text_en: textEn,
      text_en_md: textEnMd,
      text_id: textId,
      text_id_md: textIdMd,
      has_translation: row.translation_status === 'done',
      highlighted_terms: [],
    };
  }

  private buildOutlineTree(rows: ReaderSectionRecord[]) {
    const childrenByParent = new Map<string | null, ReaderSectionRecord[]>();

    for (const row of rows) {
      const key = row.parent_id;
      const bucket = childrenByParent.get(key) ?? [];
      bucket.push(row);
      childrenByParent.set(key, bucket);
    }

    const buildNode = (row: ReaderSectionRecord): Record<string, unknown> => ({
      id: row.id,
      level: row.level,
      title: row.title,
      title_id: row.title_id ?? '',
      para_start: row.para_start ?? '',
      children: (childrenByParent.get(row.id) ?? [])
        .sort((a, b) => a.order_no - b.order_no)
        .map((child) => buildNode(child)),
    });

    return (childrenByParent.get(null) ?? [])
      .sort((a, b) => a.order_no - b.order_no)
      .map((row) => buildNode(row));
  }

  private buildMapTree(rows: ReaderMapNodeRecord[]) {
    const childrenByParent = new Map<string | null, ReaderMapNodeRecord[]>();

    for (const row of rows) {
      const key = row.parent_id;
      const bucket = childrenByParent.get(key) ?? [];
      bucket.push(row);
      childrenByParent.set(key, bucket);
    }

    const buildNode = (row: ReaderMapNodeRecord): Record<string, unknown> => ({
      id: row.id,
      label: row.label,
      label_id: row.label_id ?? '',
      type: row.type,
      para_refs: row.para_refs ?? [],
      children: (childrenByParent.get(row.id) ?? [])
        .sort((a, b) => a.order_no - b.order_no)
        .map((child) => buildNode(child)),
    });

    return (childrenByParent.get(null) ?? [])
      .sort((a, b) => a.order_no - b.order_no)
      .map((row) => buildNode(row));
  }

  private async getSourceParagraphsForMapNode(
    documentId: string,
    paragraphIds: string[],
  ): Promise<
    Array<{
      id: string;
      page_no: number;
      text_raw: string;
      text_raw_md: string;
      source_lang: string;
      text_en: string;
      text_en_md: string;
      text_id: string;
      text_id_md: string;
    }>
  > {
    if (!Array.isArray(paragraphIds) || paragraphIds.length === 0) {
      return [];
    }

    const results = await Promise.all(
      paragraphIds.map((paragraphId) =>
        this.readerRepository.findParagraphById(documentId, paragraphId),
      ),
    );

    return results
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => {
        const sourceLang = row.source_lang ?? 'unknown';
        return {
          id: row.id,
          page_no: row.page_no,
          text_raw: row.text_raw,
          text_raw_md: row.text_raw_md,
          source_lang: sourceLang,
          text_en: sourceLang === 'en' ? row.text_raw : (row.text_en ?? ''),
          text_en_md:
            sourceLang === 'en' ? row.text_raw_md : (row.text_en_md ?? ''),
          text_id: sourceLang === 'id' ? row.text_raw : (row.text_id ?? ''),
          text_id_md:
            sourceLang === 'id' ? row.text_raw_md : (row.text_id_md ?? ''),
        };
      });
  }
}
