import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { withTimeout } from '../../common/utils/with-timeout.util';
import {
  DEFAULT_OPENAI_GLOSSARY_MODEL,
  DEFAULT_OPENAI_GLOSSARY_TIMEOUT_MS,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_TIMEOUT_MS,
} from './ai.constants';

@Injectable()
export class AiService {
  private readonly client: OpenAI;
  private readonly translationModel: string;
  private readonly translationTimeoutMs: number;
  private readonly glossaryModel: string;
  private readonly glossaryTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
    });

    this.translationModel = this.configService.get<string>(
      'OPENAI_TRANSLATION_MODEL',
      DEFAULT_OPENAI_TRANSLATION_MODEL,
    );
    this.translationTimeoutMs = this.configService.get<number>(
      'OPENAI_TRANSLATION_TIMEOUT_MS',
      DEFAULT_OPENAI_TRANSLATION_TIMEOUT_MS,
    );
    this.glossaryModel = this.configService.get<string>(
      'OPENAI_GLOSSARY_MODEL',
      DEFAULT_OPENAI_GLOSSARY_MODEL,
    );
    this.glossaryTimeoutMs = this.configService.get<number>(
      'OPENAI_GLOSSARY_TIMEOUT_MS',
      DEFAULT_OPENAI_GLOSSARY_TIMEOUT_MS,
    );
  }

  async detectSourceLanguage(text: string): Promise<'en' | 'id' | 'unknown'> {
    if (text.trim().length === 0) {
      return 'unknown';
    }

    const completion = await withTimeout(
      this.client.chat.completions.create({
        model: this.translationModel,
        messages: [
          {
            role: 'system',
            content:
              'You detect language for OCR text. Respond with exactly one token: en, id, or unknown.',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0,
      }),
      this.translationTimeoutMs,
      'OpenAI language detection timed out',
    );

    return this.normalizeSourceLanguage(
      completion.choices[0]?.message?.content ?? '',
    );
  }

  async translateText(input: {
    text: string;
    targetLang: 'en' | 'id';
  }): Promise<string> {
    const prompt =
      input.targetLang === 'id'
        ? 'Translate the following text to Indonesian. Return only the translated text.'
        : 'Translate the following text to English. Return only the translated text.';

    const completion = await withTimeout(
      this.client.chat.completions.create({
        model: this.translationModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a translation engine. Do not add commentary or explanations.',
          },
          {
            role: 'user',
            content: `${prompt}\n\n${input.text}`,
          },
        ],
        temperature: 0,
      }),
      this.translationTimeoutMs,
      'OpenAI translation timed out',
    );

    const content = completion.choices[0]?.message?.content;
    if (typeof content === 'string' && content.trim().length > 0) {
      return content.trim();
    }

    throw new Error('OpenAI translation response did not contain text');
  }

  async translateMarkdown(input: {
    markdown: string;
    targetLang: 'en' | 'id';
  }): Promise<string> {
    if (input.markdown.trim().length === 0) {
      return '';
    }

    const prompt =
      input.targetLang === 'id'
        ? 'Translate the markdown content to Indonesian. Preserve markdown syntax, image/link URLs, and non-translatable identifiers. Return markdown only.'
        : 'Translate the markdown content to English. Preserve markdown syntax, image/link URLs, and non-translatable identifiers. Return markdown only.';

    const completion = await withTimeout(
      this.client.chat.completions.create({
        model: this.translationModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a translation engine. Preserve markdown structure exactly, keep URLs unchanged, and do not add commentary.',
          },
          {
            role: 'user',
            content: `${prompt}\n\n${input.markdown}`,
          },
        ],
        temperature: 0,
      }),
      this.translationTimeoutMs,
      'OpenAI markdown translation timed out',
    );

    const content = completion.choices[0]?.message?.content;
    if (typeof content === 'string' && content.trim().length > 0) {
      return content.trim();
    }

    throw new Error('OpenAI markdown translation response did not contain text');
  }

  async extractGlossaryFromParagraphs(input: {
    sourceLang: 'en' | 'id' | 'unknown';
    paragraphs: Array<{
      id: string;
      page_no: number;
      text_raw: string;
    }>;
    maxTerms: number;
  }): Promise<
    Array<{
      term_en: string;
      definition: string | null;
      definition_id: string | null;
      example: string | null;
      example_id: string | null;
      paragraph_ids: string[];
    }>
  > {
    if (input.paragraphs.length === 0 || input.maxTerms <= 0) {
      return [];
    }

    const paragraphPayload = input.paragraphs.map((paragraph) => ({
      id: paragraph.id,
      page_no: paragraph.page_no,
      text_raw: paragraph.text_raw,
    }));

    const completion = await withTimeout(
      this.client.chat.completions.create({
        model: this.glossaryModel,
        messages: [
          {
            role: 'system',
            content:
              'You extract glossary terms from academic document paragraphs. Return strict JSON only.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              instruction:
                'Extract technical terms from the paragraphs. Respond with a JSON object: {"terms":[{"term_en":"string","definition":"string|null","definition_id":"string|null","example":"string|null","example_id":"string|null","paragraph_ids":["paragraph_id"]}]}. term_en must be English canonical term. Keep to max_terms.',
              source_lang: input.sourceLang,
              max_terms: input.maxTerms,
              paragraphs: paragraphPayload,
            }),
          },
        ],
        temperature: 0,
      }),
      this.glossaryTimeoutMs,
      'OpenAI glossary extraction timed out',
    );

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('OpenAI glossary response did not contain text');
    }

    return this.parseGlossaryResponse(content);
  }

  private normalizeSourceLanguage(value: string): 'en' | 'id' | 'unknown' {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'en') {
      return 'en';
    }
    if (normalized === 'id') {
      return 'id';
    }
    return 'unknown';
  }

  private parseGlossaryResponse(raw: string): Array<{
    term_en: string;
    definition: string | null;
    definition_id: string | null;
    example: string | null;
    example_id: string | null;
    paragraph_ids: string[];
  }> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('OpenAI glossary response is not valid JSON');
    }

    if (!parsed || typeof parsed !== 'object') {
      return [];
    }

    const terms = (parsed as { terms?: unknown }).terms;
    if (!Array.isArray(terms)) {
      return [];
    }

    const sanitizeText = (value: unknown): string | null => {
      if (typeof value !== 'string') {
        return null;
      }
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    };

    return terms
      .map((candidate) => {
        if (!candidate || typeof candidate !== 'object') {
          return null;
        }

        const source = candidate as {
          term_en?: unknown;
          definition?: unknown;
          definition_id?: unknown;
          example?: unknown;
          example_id?: unknown;
          paragraph_ids?: unknown;
        };
        const termEn = sanitizeText(source.term_en);
        if (!termEn) {
          return null;
        }

        const paragraphIds = Array.isArray(source.paragraph_ids)
          ? source.paragraph_ids
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim())
              .filter((value) => value.length > 0)
          : [];

        return {
          term_en: termEn,
          definition: sanitizeText(source.definition),
          definition_id: sanitizeText(source.definition_id),
          example: sanitizeText(source.example),
          example_id: sanitizeText(source.example_id),
          paragraph_ids: Array.from(new Set(paragraphIds)),
        };
      })
      .filter(
        (
          row,
        ): row is {
          term_en: string;
          definition: string | null;
          definition_id: string | null;
          example: string | null;
          example_id: string | null;
          paragraph_ids: string[];
        } => row !== null,
      );
  }
}
