import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { withTimeout } from '../../common/utils/with-timeout.util';
import {
  DEFAULT_OPENAI_GLOSSARY_MODEL,
  DEFAULT_OPENAI_GLOSSARY_TIMEOUT_MS,
  DEFAULT_OPENAI_TRANSLATION_MODEL,
  DEFAULT_OPENAI_TRANSLATION_TIMEOUT_MS,
  DEFAULT_OPENAI_VIDEO_CREATIVE_MODEL,
  DEFAULT_OPENAI_VIDEO_CREATIVE_TIMEOUT_MS,
} from './ai.constants';

type VideoCreativePlanResult = {
  topic: string;
  summary: {
    topic: string;
    hook: string;
    problem: string;
    method: string;
    result: string;
    takeaway: string;
    source_excerpt_count: number;
  };
  scenes: Array<{
    sceneIndex: number;
    templateType:
      | 'hook'
      | 'problem'
      | 'mechanism'
      | 'evidence'
      | 'takeaway';
    title: string;
    body: string;
    bullets: string[];
    narrationText: string;
    transition: 'none' | 'fade' | 'slide' | 'wipe';
    accentColor?: string | null;
    emphasisTerms?: string[];
  }>;
};

@Injectable()
export class AiService {
  private readonly client: OpenAI;
  private readonly translationModel: string;
  private readonly translationTimeoutMs: number;
  private readonly glossaryModel: string;
  private readonly glossaryTimeoutMs: number;
  private readonly videoCreativeModel: string;
  private readonly videoCreativeTimeoutMs: number;

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
    this.videoCreativeModel = this.configService.get<string>(
      'VIDEO_CREATIVE_MODEL',
      DEFAULT_OPENAI_VIDEO_CREATIVE_MODEL,
    );
    this.videoCreativeTimeoutMs = this.configService.get<number>(
      'VIDEO_CREATIVE_TIMEOUT_MS',
      DEFAULT_OPENAI_VIDEO_CREATIVE_TIMEOUT_MS,
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

  async generateVideoCreativePlan(input: {
    topic: string;
    sourceText: string;
    targetLanguage: 'en' | 'id';
    targetDurationSec: number;
    sourceExcerptCount: number;
  }): Promise<VideoCreativePlanResult> {
    const languageLabel =
      input.targetLanguage === 'id' ? 'Indonesian' : 'English';

    const completion = await withTimeout(
      this.client.chat.completions.create({
        model: this.videoCreativeModel,
        messages: [
          {
            role: 'system',
            content:
              'You create short educational video plans for deterministic React templates. Respond with strict JSON only. Never include markdown fences or commentary.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              instruction:
                'Create a 5-scene creative plan for a short explainer video. Use only template types hook, problem, mechanism, evidence, takeaway. Use only transitions fade, slide, wipe, none. All text must be in the requested language. Each scene must include title, body, up to 3 bullets, narrationText, and an optional accentColor hex string.',
              topic: input.topic,
              target_language: languageLabel,
              target_duration_sec: input.targetDurationSec,
              source_excerpt_count: input.sourceExcerptCount,
              required_json_shape: {
                topic: 'string',
                summary: {
                  topic: 'string',
                  hook: 'string',
                  problem: 'string',
                  method: 'string',
                  result: 'string',
                  takeaway: 'string',
                  source_excerpt_count: 'number',
                },
                scenes: [
                  {
                    sceneIndex: 1,
                    templateType: 'hook',
                    title: 'string',
                    body: 'string',
                    bullets: ['string'],
                    narrationText: 'string',
                    transition: 'fade',
                    accentColor: '#38bdf8',
                    emphasisTerms: ['string'],
                  },
                ],
              },
              source_text: input.sourceText,
            }),
          },
        ],
        temperature: 0.2,
      }),
      this.videoCreativeTimeoutMs,
      'OpenAI video creative planning timed out',
    );

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('OpenAI video creative response did not contain text');
    }

    return this.parseVideoCreativePlan(content);
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

  private parseVideoCreativePlan(raw: string): VideoCreativePlanResult {
    const parsed = this.parseJsonObject(raw, 'OpenAI video creative response');
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];

    if (typeof parsed.topic !== 'string' || parsed.topic.trim().length === 0) {
      throw new Error('OpenAI video creative response is missing topic');
    }
    if (!parsed.summary || typeof parsed.summary !== 'object') {
      throw new Error('OpenAI video creative response is missing summary');
    }
    if (scenes.length !== 5) {
      throw new Error('OpenAI video creative response must contain 5 scenes');
    }

    const summarySource = parsed.summary as Record<string, unknown>;

    return {
      topic: parsed.topic.trim(),
      summary: {
        topic: this.requireText(summarySource.topic, 'summary.topic'),
        hook: this.requireText(summarySource.hook, 'summary.hook'),
        problem: this.requireText(summarySource.problem, 'summary.problem'),
        method: this.requireText(summarySource.method, 'summary.method'),
        result: this.requireText(summarySource.result, 'summary.result'),
        takeaway: this.requireText(summarySource.takeaway, 'summary.takeaway'),
        source_excerpt_count:
          typeof summarySource.source_excerpt_count === 'number'
            ? summarySource.source_excerpt_count
            : 0,
      },
      scenes: scenes.map((scene, index) => {
        if (!scene || typeof scene !== 'object') {
          throw new Error('OpenAI video creative scene is invalid');
        }

        const source = scene as Record<string, unknown>;
        return {
          sceneIndex:
            typeof source.sceneIndex === 'number' ? source.sceneIndex : index + 1,
          templateType: this.requireSceneTemplate(source.templateType),
          title: this.requireText(source.title, `scenes[${index}].title`),
          body: this.requireText(source.body, `scenes[${index}].body`),
          bullets: this.parseStringArray(source.bullets, 3),
          narrationText: this.requireText(
            source.narrationText,
            `scenes[${index}].narrationText`,
          ),
          transition: this.requireSceneTransition(source.transition),
          accentColor:
            typeof source.accentColor === 'string' ? source.accentColor : null,
          emphasisTerms: this.parseStringArray(source.emphasisTerms, 3),
        };
      }),
    };
  }

  private parseJsonObject(raw: string, label: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error(`${label} is not a JSON object`);
      }

      return parsed as Record<string, unknown>;
    } catch {
      throw new Error(`${label} is not valid JSON`);
    }
  }

  private requireText(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`OpenAI video creative response is missing ${field}`);
    }

    return value.trim();
  }

  private parseStringArray(value: unknown, limit: number): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, limit);
  }

  private requireSceneTemplate(
    value: unknown,
  ): 'hook' | 'problem' | 'mechanism' | 'evidence' | 'takeaway' {
    if (
      value === 'hook' ||
      value === 'problem' ||
      value === 'mechanism' ||
      value === 'evidence' ||
      value === 'takeaway'
    ) {
      return value;
    }

    throw new Error(`Unsupported AI template type: ${String(value)}`);
  }

  private requireSceneTransition(
    value: unknown,
  ): 'none' | 'fade' | 'slide' | 'wipe' {
    if (
      value === 'none' ||
      value === 'fade' ||
      value === 'slide' ||
      value === 'wipe'
    ) {
      return value;
    }

    throw new Error(`Unsupported AI transition type: ${String(value)}`);
  }
}
