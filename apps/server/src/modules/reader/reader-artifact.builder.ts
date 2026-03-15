import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AiService } from '../../infrastructure/ai/ai.service';
import type { ReaderArtifactsBundle } from './reader.types';
import { ReaderMarkdownService } from './reader-markdown.service';

type OcrPage = {
  index?: number;
  markdown?: string;
  images?: Record<string, string>;
};

type OcrResult = {
  pages?: OcrPage[];
};

type ParagraphDraft = {
  id: string;
  page_no: number;
  order_no: number;
  text_raw: string;
  text_raw_md: string;
  section_id: string;
};

type HeadingDraft = {
  title: string;
  level: number;
};

@Injectable()
export class ReaderArtifactBuilder {
  constructor(
    private readonly aiService: AiService,
    private readonly readerMarkdownService: ReaderMarkdownService,
  ) {}

  async buildFromOcrResult(
    documentId: string,
    ocrResult: unknown,
    requireTranslate: boolean,
    sourceLang: 'en' | 'id' | 'unknown',
  ): Promise<ReaderArtifactsBundle> {
    const normalized = this.normalizeOcrResult(ocrResult);
    const warnings: ReaderArtifactsBundle['warnings'] = [];
    const rootSectionId = `${documentId}_s_root`;

    const sectionRows: ReaderArtifactsBundle['sections'] = [
      {
        id: rootSectionId,
        parent_id: null,
        level: 1,
        title: 'Document',
        title_id: null,
        para_start: null,
        order_no: 0,
      },
    ];

    const headingCandidates: Array<
      HeadingDraft & { order_no: number; page_no: number; chunk: string }
    > = [];
    const paragraphDrafts: Array<ParagraphDraft & { page_no: number }> = [];

    let paragraphCounter = 0;
    for (const page of normalized.pages ?? []) {
      const pageNo = page.index ?? 1;
      const chunks = this.splitMarkdownIntoParagraphs(page.markdown ?? '');
      for (const chunk of chunks) {
        const heading = this.parseHeadingChunk(chunk);
        if (heading) {
          headingCandidates.push({
            ...heading,
            order_no: paragraphCounter,
            page_no: pageNo,
            chunk,
          });
          continue;
        }

        const paragraphId = `${documentId}_p_${paragraphCounter + 1}`;
        const rewritten = await this.readerMarkdownService.rewriteMarkdownAssets({
          documentId,
          paragraphId,
          markdown: chunk,
          pageImages: page.images ?? {},
        });

        for (const warning of rewritten.warnings) {
          warnings.push({
            id: `${documentId}_w_asset_${warnings.length + 1}`,
            code: warning.code,
            message: warning.message,
            pages: [pageNo],
          });
        }

        paragraphDrafts.push({
          id: paragraphId,
          section_id: rootSectionId,
          order_no: paragraphCounter,
          page_no: pageNo,
          text_raw: this.readerMarkdownService.stripMarkdown(rewritten.markdown),
          text_raw_md: rewritten.markdown,
        });
        paragraphCounter += 1;
      }
    }

    if (headingCandidates.length > 0) {
      this.applyOutlineFromHeadings(
        documentId,
        rootSectionId,
        headingCandidates,
        paragraphDrafts,
        sectionRows,
      );
    } else {
      this.applyOutlineFallbackByPage(
        documentId,
        rootSectionId,
        paragraphDrafts,
        sectionRows,
      );
      warnings.push({
        id: `${documentId}_w_outline_fallback_pages`,
        code: 'outline_fallback_page_sections',
        message:
          'No heading structure detected in OCR markdown; generated page-based outline sections.',
        pages: Array.from(
          new Set(paragraphDrafts.map((row) => row.page_no)),
        ).sort((a, b) => a - b),
      });
    }

    const paragraphs: ReaderArtifactsBundle['paragraphs'] = paragraphDrafts.map(
      (row) => ({
        id: row.id,
        section_id: row.section_id,
        order_no: row.order_no,
        page_no: row.page_no,
        source_start: null,
        source_end: null,
        text_raw: row.text_raw,
        text_raw_md: row.text_raw_md,
      }),
    );

    const translations: ReaderArtifactsBundle['translations'] = [];
    if (requireTranslate) {
      for (const paragraph of paragraphs) {
          translations.push({
            paragraph_id: paragraph.id,
            status: 'pending',
            text_en: null,
            text_en_md: null,
            text_id: null,
            text_id_md: null,
            cache_hash: null,
            translated_at: null,
          });
      }
    }

    const { terms, term_occurrences, glossaryWarnings } =
      await this.buildGlossaryArtifacts(documentId, sourceLang, paragraphs);
    warnings.push(...glossaryWarnings);

    return {
      sections: sectionRows,
      paragraphs,
      translations,
      terms,
      term_occurrences,
      map_nodes: [],
      warnings,
    };
  }

  private normalizeOcrResult(value: unknown): OcrResult {
    if (!value || typeof value !== 'object') {
      return { pages: [] };
    }

    const candidate = value as { pages?: unknown };
    if (!Array.isArray(candidate.pages)) {
      return { pages: [] };
    }

    const rawPages = candidate.pages as unknown[];
    const pages: OcrPage[] = [];
    for (let i = 0; i < rawPages.length; i += 1) {
      const pageValue: unknown = rawPages[i];
      if (!pageValue || typeof pageValue !== 'object') {
        continue;
      }

      const page = pageValue as {
        index?: unknown;
        markdown?: unknown;
        images?: unknown;
      };
      pages.push({
        index:
          typeof page.index === 'number' && Number.isFinite(page.index)
            ? page.index + 1
            : i + 1,
        markdown: typeof page.markdown === 'string' ? page.markdown : '',
        images: this.normalizePageImages(page.images),
      });
    }

    return { pages };
  }

  private normalizePageImages(value: unknown): Record<string, string> {
    if (!Array.isArray(value)) {
      return {};
    }

    const entries: Array<[string, string]> = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const image = item as {
        id?: unknown;
        image_base64?: unknown;
        imageBase64?: unknown;
      };
      const payload =
        typeof image.image_base64 === 'string' &&
        image.image_base64.trim().length > 0
          ? image.image_base64.trim()
          : typeof image.imageBase64 === 'string' &&
              image.imageBase64.trim().length > 0
            ? image.imageBase64.trim()
            : null;
      if (
        typeof image.id === 'string' &&
        image.id.trim().length > 0 &&
        payload
      ) {
        entries.push([image.id.trim(), payload]);
      }
    }

    return Object.fromEntries(entries);
  }

  private splitMarkdownIntoParagraphs(markdown: string): string[] {
    const normalized = markdown.trim();
    if (normalized.length === 0) {
      return [];
    }

    return normalized
      .split(/\n\s*\n+/g)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);
  }

  private parseHeadingChunk(value: string): HeadingDraft | null {
    const atx = value.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/s);
    if (atx) {
      return {
        title: this.normalizeHeadingTitle(atx[2]),
        level: Math.min(atx[1].length + 1, 6),
      };
    }

    const numbered = value.match(/^((?:\d+\.)*\d+)[).]?\s+(.+)$/s);
    if (numbered) {
      const depth = numbered[1].split('.').length;
      return {
        title: this.normalizeHeadingTitle(numbered[2]),
        level: Math.min(depth + 1, 6),
      };
    }

    return null;
  }

  private normalizeHeadingTitle(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private applyOutlineFromHeadings(
    documentId: string,
    rootSectionId: string,
    headingCandidates: Array<
      HeadingDraft & { order_no: number; page_no: number; chunk: string }
    >,
    paragraphDrafts: ParagraphDraft[],
    sectionRows: ReaderArtifactsBundle['sections'],
  ): void {
    const sectionByOrder = new Map<number, string>();
    const sectionById = new Map<
      string,
      ReaderArtifactsBundle['sections'][number]
    >();
    const sectionLevelStack = new Map<number, string>();
    sectionLevelStack.set(1, rootSectionId);
    sectionById.set(rootSectionId, sectionRows[0]);

    let sectionOrderNo = 1;
    let paragraphCursor = 0;
    let headingCursor = 0;

    for (const heading of headingCandidates) {
      const sectionId = `${documentId}_s_h_${headingCursor + 1}`;
      headingCursor += 1;

      const level = Math.max(2, heading.level);
      for (const key of Array.from(sectionLevelStack.keys())) {
        if (key >= level) {
          sectionLevelStack.delete(key);
        }
      }

      const parentId = sectionLevelStack.get(level - 1) ?? rootSectionId;

      sectionRows.push({
        id: sectionId,
        parent_id: parentId,
        level,
        title: heading.title,
        title_id: null,
        para_start: null,
        order_no: sectionOrderNo,
      });
      sectionById.set(sectionId, sectionRows[sectionRows.length - 1]);

      sectionByOrder.set(sectionOrderNo, sectionId);
      sectionLevelStack.set(level, sectionId);
      sectionOrderNo += 1;
    }

    let currentSectionId = rootSectionId;
    for (const paragraph of paragraphDrafts) {
      while (
        paragraphCursor < headingCandidates.length &&
        headingCandidates[paragraphCursor].order_no <= paragraph.order_no
      ) {
        const nextSectionOrder = paragraphCursor + 1;
        currentSectionId =
          sectionByOrder.get(nextSectionOrder) ?? rootSectionId;
        paragraphCursor += 1;
      }

      paragraph.section_id = currentSectionId;
      const section = sectionById.get(currentSectionId);
      if (section && section.para_start === null) {
        section.para_start = paragraph.id;
      }
    }
  }

  private applyOutlineFallbackByPage(
    documentId: string,
    rootSectionId: string,
    paragraphDrafts: ParagraphDraft[],
    sectionRows: ReaderArtifactsBundle['sections'],
  ): void {
    const pageSectionMap = new Map<number, string>();
    let sectionOrderNo = 1;

    for (const paragraph of paragraphDrafts) {
      let sectionId = pageSectionMap.get(paragraph.page_no);
      if (!sectionId) {
        sectionId = `${documentId}_s_page_${paragraph.page_no}`;
        pageSectionMap.set(paragraph.page_no, sectionId);
        sectionRows.push({
          id: sectionId,
          parent_id: rootSectionId,
          level: 2,
          title: `Page ${paragraph.page_no}`,
          title_id: null,
          para_start: paragraph.id,
          order_no: sectionOrderNo,
        });
        sectionOrderNo += 1;
      }

      paragraph.section_id = sectionId;
    }
  }

  private async buildGlossaryArtifacts(
    documentId: string,
    sourceLang: 'en' | 'id' | 'unknown',
    paragraphs: ReaderArtifactsBundle['paragraphs'],
  ): Promise<{
    terms: ReaderArtifactsBundle['terms'];
    term_occurrences: ReaderArtifactsBundle['term_occurrences'];
    glossaryWarnings: ReaderArtifactsBundle['warnings'];
  }> {
    const glossaryWarnings: ReaderArtifactsBundle['warnings'] = [];
    if (paragraphs.length === 0) {
      return {
        terms: [],
        term_occurrences: [],
        glossaryWarnings,
      };
    }

    const paragraphById = new Map(paragraphs.map((row) => [row.id, row]));
    const batches = this.createParagraphBatches(paragraphs, 12_000);

    const merged = new Map<
      string,
      {
        term_en: string;
        definition: string | null;
        definition_id: string | null;
        example: string | null;
        example_id: string | null;
        paragraph_ids: Set<string>;
      }
    >();

    for (const batch of batches) {
      try {
        const extracted = await this.aiService.extractGlossaryFromParagraphs({
          sourceLang,
          paragraphs: batch.map((row) => ({
            id: row.id,
            page_no: row.page_no,
            text_raw: row.text_raw,
          })),
          maxTerms: 20,
        });

        for (const row of extracted) {
          const normalizedKey = row.term_en.trim().toLowerCase();
          if (normalizedKey.length === 0) {
            continue;
          }

          const entry = merged.get(normalizedKey) ?? {
            term_en: row.term_en,
            definition: row.definition,
            definition_id: row.definition_id,
            example: row.example,
            example_id: row.example_id,
            paragraph_ids: new Set<string>(),
          };

          if (!entry.definition && row.definition) {
            entry.definition = row.definition;
          }
          if (!entry.definition_id && row.definition_id) {
            entry.definition_id = row.definition_id;
          }
          if (!entry.example && row.example) {
            entry.example = row.example;
          }
          if (!entry.example_id && row.example_id) {
            entry.example_id = row.example_id;
          }

          for (const paragraphId of row.paragraph_ids) {
            if (paragraphById.has(paragraphId)) {
              entry.paragraph_ids.add(paragraphId);
            }
          }

          merged.set(normalizedKey, entry);
        }
      } catch (error) {
        glossaryWarnings.push({
          id: `${documentId}_w_glossary_batch_${glossaryWarnings.length + 1}`,
          code: 'glossary_extract_batch_failed',
          message:
            error instanceof Error
              ? `Glossary extraction failed for one batch: ${error.message}`
              : 'Glossary extraction failed for one batch',
          pages: Array.from(new Set(batch.map((row) => row.page_no))).sort(
            (a, b) => a - b,
          ),
        });
      }
    }

    if (merged.size === 0) {
      glossaryWarnings.push({
        id: `${documentId}_w_glossary_empty`,
        code: 'glossary_extract_empty',
        message: 'Glossary extraction produced no terms.',
        pages: [],
      });
      return {
        terms: [],
        term_occurrences: [],
        glossaryWarnings,
      };
    }

    const ranked = Array.from(merged.values())
      .map((row) => ({
        ...row,
        occurrence_count: row.paragraph_ids.size,
      }))
      .filter((row) => row.occurrence_count > 0)
      .sort((a, b) => {
        if (b.occurrence_count !== a.occurrence_count) {
          return b.occurrence_count - a.occurrence_count;
        }
        return a.term_en.localeCompare(b.term_en);
      })
      .slice(0, 50);

    const terms: ReaderArtifactsBundle['terms'] = [];
    const termOccurrences: ReaderArtifactsBundle['term_occurrences'] = [];

    for (const term of ranked) {
      const hash = createHash('sha1')
        .update(term.term_en.toLowerCase())
        .digest('hex');
      const termId = `${documentId}_t_${hash.slice(0, 12)}`;

      terms.push({
        id: termId,
        term_en: term.term_en,
        definition: term.definition,
        definition_id: term.definition_id,
        example: term.example,
        example_id: term.example_id,
        occurrence_count: term.occurrence_count,
      });

      const occurrenceParagraphIds = Array.from(term.paragraph_ids)
        .map((paragraphId) => paragraphById.get(paragraphId))
        .filter(
          (row): row is ReaderArtifactsBundle['paragraphs'][number] =>
            row !== undefined,
        )
        .sort((a, b) => a.order_no - b.order_no)
        .slice(0, 20);

      for (let i = 0; i < occurrenceParagraphIds.length; i += 1) {
        const paragraph = occurrenceParagraphIds[i];
        termOccurrences.push({
          id: `${termId}_o_${i + 1}`,
          term_id: termId,
          paragraph_id: paragraph.id,
          page_no: paragraph.page_no,
          snippet_en: paragraph.text_raw.slice(0, 240),
        });
      }
    }

    return {
      terms,
      term_occurrences: termOccurrences,
      glossaryWarnings,
    };
  }

  private createParagraphBatches(
    paragraphs: ReaderArtifactsBundle['paragraphs'],
    maxChars: number,
  ): ReaderArtifactsBundle['paragraphs'][] {
    const batches: ReaderArtifactsBundle['paragraphs'][] = [];
    let currentBatch: ReaderArtifactsBundle['paragraphs'] = [];
    let currentChars = 0;

    for (const paragraph of paragraphs) {
      const paragraphChars = paragraph.text_raw.length;
      if (currentBatch.length > 0 && currentChars + paragraphChars > maxChars) {
        batches.push(currentBatch);
        currentBatch = [];
        currentChars = 0;
      }

      currentBatch.push(paragraph);
      currentChars += paragraphChars;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }
}
