import { AiService } from '../../../infrastructure/ai/ai.service';
import { ReaderArtifactBuilder } from '../reader-artifact.builder';
import { ReaderMarkdownService } from '../reader-markdown.service';

describe('ReaderArtifactBuilder', () => {
  const extractGlossaryFromParagraphsMock = jest.fn();
  const rewriteMarkdownAssetsMock = jest.fn();
  const stripMarkdownMock = jest.fn();

  const aiService = {
    extractGlossaryFromParagraphs: extractGlossaryFromParagraphsMock,
  } as unknown as AiService;

  const readerMarkdownService = {
    rewriteMarkdownAssets: rewriteMarkdownAssetsMock,
    stripMarkdown: stripMarkdownMock,
  } as unknown as ReaderMarkdownService;

  const builder = new ReaderArtifactBuilder(aiService, readerMarkdownService);

  beforeEach(() => {
    jest.clearAllMocks();
    extractGlossaryFromParagraphsMock.mockResolvedValue([]);
    rewriteMarkdownAssetsMock.mockImplementation(
      async ({ markdown }: { markdown: string }) => ({
        markdown,
        warnings: [],
      }),
    );
    stripMarkdownMock.mockImplementation((markdown: string) => markdown);
  });

  it('builds hierarchical sections from markdown headings', async () => {
    const artifacts = await builder.buildFromOcrResult(
      'doc_1',
      {
        pages: [
          {
            index: 0,
            markdown:
              '# Introduction\n\nThis is intro paragraph.\n\n## Methods\n\nThis is methods paragraph.',
          },
        ],
      },
      false,
      'en',
    );

    expect(artifacts.sections.map((section) => section.title)).toEqual([
      'Document',
      'Introduction',
      'Methods',
    ]);

    const introductionSection = artifacts.sections.find(
      (section) => section.title === 'Introduction',
    );
    const methodsSection = artifacts.sections.find(
      (section) => section.title === 'Methods',
    );

    expect(introductionSection?.parent_id).toBe('doc_1_s_root');
    expect(methodsSection?.parent_id).toBe(introductionSection?.id);

    expect(artifacts.paragraphs[0]?.section_id).toBe(introductionSection?.id);
    expect(artifacts.paragraphs[1]?.section_id).toBe(methodsSection?.id);
    expect(artifacts.paragraphs[0]?.text_raw_md).toBe('This is intro paragraph.');
  });

  it('falls back to page sections when no headings are detected', async () => {
    const artifacts = await builder.buildFromOcrResult(
      'doc_2',
      {
        pages: [
          { index: 0, markdown: 'First page paragraph.' },
          { index: 1, markdown: 'Second page paragraph.' },
        ],
      },
      false,
      'en',
    );

    expect(artifacts.sections.map((section) => section.title)).toEqual([
      'Document',
      'Page 1',
      'Page 2',
    ]);

    expect(
      artifacts.warnings.some(
        (warning) => warning.code === 'outline_fallback_page_sections',
      ),
    ).toBe(true);
  });

  it('degrades gracefully when one glossary batch fails', async () => {
    extractGlossaryFromParagraphsMock
      .mockRejectedValueOnce(new Error('batch timeout'))
      .mockResolvedValueOnce([
        {
          term_en: 'Transformer',
          definition: 'Model architecture.',
          definition_id: 'Arsitektur model.',
          example: 'Transformer uses self-attention.',
          example_id: 'Transformer menggunakan self-attention.',
          paragraph_ids: ['doc_3_p_2'],
        },
      ]);

    const longText = 'x'.repeat(13_000);

    const artifacts = await builder.buildFromOcrResult(
      'doc_3',
      {
        pages: [
          {
            index: 0,
            markdown: `${longText}\n\n${longText}`,
          },
        ],
      },
      false,
      'en',
    );

    expect(artifacts.terms.length).toBe(1);
    expect(artifacts.term_occurrences.length).toBe(1);
    expect(
      artifacts.warnings.some(
        (warning) => warning.code === 'glossary_extract_batch_failed',
      ),
    ).toBe(true);
  });

  it('rewrites markdown assets before storing paragraph markdown', async () => {
    rewriteMarkdownAssetsMock.mockResolvedValue({
      markdown: 'Paragraph with ![Figure](https://cdn.local/figure.jpg)',
      warnings: [],
    });
    stripMarkdownMock.mockReturnValue('Paragraph with');

    const artifacts = await builder.buildFromOcrResult(
      'doc_4',
      {
        pages: [
          {
            index: 0,
            markdown: 'Paragraph with ![Figure](img-0.jpeg)',
            images: [{ id: 'img-0.jpeg', image_base64: 'ZmFrZQ==' }],
          },
        ],
      },
      false,
      'en',
    );

    expect(rewriteMarkdownAssetsMock).toHaveBeenCalledWith({
      documentId: 'doc_4',
      paragraphId: 'doc_4_p_1',
      markdown: 'Paragraph with ![Figure](img-0.jpeg)',
      pageImages: { 'img-0.jpeg': 'ZmFrZQ==' },
    });
    expect(artifacts.paragraphs[0]?.text_raw).toBe('Paragraph with');
    expect(artifacts.paragraphs[0]?.text_raw_md).toBe(
      'Paragraph with ![Figure](https://cdn.local/figure.jpg)',
    );
  });

  it('maps Mistral camelCase imageBase64 payloads for markdown asset rewrite', async () => {
    rewriteMarkdownAssetsMock.mockResolvedValue({
      markdown: 'Paragraph with ![Figure](https://cdn.local/figure.jpg)',
      warnings: [],
    });
    stripMarkdownMock.mockReturnValue('Paragraph with');

    await builder.buildFromOcrResult(
      'doc_5',
      {
        pages: [
          {
            index: 0,
            markdown: 'Paragraph with ![Figure](img-0.jpeg)',
            images: [{ id: 'img-0.jpeg', imageBase64: 'ZmFrZQ==' }],
          },
        ],
      },
      false,
      'en',
    );

    expect(rewriteMarkdownAssetsMock).toHaveBeenCalledWith({
      documentId: 'doc_5',
      paragraphId: 'doc_5_p_1',
      markdown: 'Paragraph with ![Figure](img-0.jpeg)',
      pageImages: { 'img-0.jpeg': 'ZmFrZQ==' },
    });
  });
});
