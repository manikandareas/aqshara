import { AiService } from '../../../infrastructure/ai/ai.service';
import { ReaderMarkdownService } from '../../reader/reader-markdown.service';
import { ReaderService } from '../../reader/reader.service';
import { PipelineTranslationRetryProcessorService } from '../pipeline-translation-retry-processor.service';

describe('PipelineTranslationRetryProcessorService', () => {
  const getTranslationRetryContextMock = jest.fn();
  const completeTranslationRetryMock = jest.fn();
  const failTranslationRetryMock = jest.fn();
  const translateMarkdownMock = jest.fn();
  const stripMarkdownMock = jest.fn();

  const readerService = {
    getTranslationRetryContext: getTranslationRetryContextMock,
    completeTranslationRetry: completeTranslationRetryMock,
    failTranslationRetry: failTranslationRetryMock,
  } as unknown as ReaderService;

  const aiService = {
    translateMarkdown: translateMarkdownMock,
  } as unknown as AiService;

  const readerMarkdownService = {
    stripMarkdown: stripMarkdownMock,
  } as unknown as ReaderMarkdownService;

  const service = new PipelineTranslationRetryProcessorService(
    readerService,
    aiService,
    readerMarkdownService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes translation retry on success', async () => {
    getTranslationRetryContextMock.mockResolvedValue({
      paragraphId: 'p_1',
      textRaw: 'halo dunia',
      textRawMd: 'halo **dunia**',
      sourceLang: 'id',
    });
    translateMarkdownMock.mockResolvedValue('hello **world**');
    stripMarkdownMock.mockReturnValue('hello world');
    completeTranslationRetryMock.mockResolvedValue(undefined);

    await service.process({
      document_id: 'doc_1',
      paragraph_id: 'p_1',
      actor_id: 'user_1',
    });

    expect(completeTranslationRetryMock).toHaveBeenCalledWith('doc_1', 'p_1', {
      textEn: 'hello world',
      textEnMd: 'hello **world**',
      textId: null,
      textIdMd: null,
    });
  });

  it('marks translation error on failure', async () => {
    getTranslationRetryContextMock.mockResolvedValue({
      paragraphId: 'p_1',
      textRaw: 'hello world',
      textRawMd: 'hello **world**',
      sourceLang: 'en',
    });
    translateMarkdownMock.mockRejectedValue(new Error('translate fail'));

    await expect(
      service.process({
        document_id: 'doc_1',
        paragraph_id: 'p_1',
        actor_id: 'user_1',
      }),
    ).rejects.toThrow('translate fail');

    expect(failTranslationRetryMock).toHaveBeenCalledWith('doc_1', 'p_1');
  });
});
