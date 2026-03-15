import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai.service';

const createMock = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
  })),
}));

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    jest.clearAllMocks();

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'OPENAI_API_KEY') {
          return 'test_openai_key';
        }
        throw new Error(`Unexpected getOrThrow key: ${key}`);
      }),
      get: jest.fn((key: string, defaultValue: unknown) => {
        if (key === 'OPENAI_TRANSLATION_MODEL') {
          return 'gpt-4.1';
        }
        if (key === 'OPENAI_TRANSLATION_TIMEOUT_MS') {
          return 60_000;
        }
        return defaultValue;
      }),
    } as unknown as ConfigService;

    service = new AiService(configService);
  });

  it('translates text to Indonesian', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'Halo dunia' } }],
    });

    const result = await service.translateText({
      text: 'Hello world',
      targetLang: 'id',
    });

    expect(result).toBe('Halo dunia');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('translates markdown while preserving response text', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'Halo **dunia**' } }],
    });

    const result = await service.translateMarkdown({
      markdown: 'Hello **world**',
      targetLang: 'id',
    });

    expect(result).toBe('Halo **dunia**');
  });

  it('detects source language and normalizes unknown values', async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'id' } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'bahasa_indonesia' } }],
      });

    await expect(service.detectSourceLanguage('Halo dunia')).resolves.toBe(
      'id',
    );
    await expect(service.detectSourceLanguage('???')).resolves.toBe('unknown');
  });

  it('throws when OpenAI response has no text', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(
      service.translateText({
        text: 'Hello world',
        targetLang: 'id',
      }),
    ).rejects.toThrow('OpenAI translation response did not contain text');
  });

  it('extracts glossary terms from structured JSON response', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              terms: [
                {
                  term_en: 'Attention Mechanism',
                  definition: 'A neural network component for focus weighting.',
                  definition_id:
                    'Komponen jaringan saraf untuk pembobotan fokus.',
                  example: 'Transformer uses attention.',
                  example_id: 'Transformer menggunakan attention.',
                  paragraph_ids: ['p_1', 'p_2'],
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.extractGlossaryFromParagraphs({
      sourceLang: 'en',
      paragraphs: [
        {
          id: 'p_1',
          page_no: 1,
          text_raw: 'Attention is used in transformers.',
        },
      ],
      maxTerms: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.term_en).toBe('Attention Mechanism');
    expect(result[0]?.paragraph_ids).toEqual(['p_1', 'p_2']);
  });
});
