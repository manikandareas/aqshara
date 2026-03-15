import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QueueService } from '../../../infrastructure/queue/queue.service';
import { DocumentsRepository } from '../../documents/documents.repository';
import { ReaderArtifactBuilder } from '../reader-artifact.builder';
import { ReaderRepository } from '../reader.repository';
import { ReaderService } from '../reader.service';

describe('ReaderService', () => {
  const findOwnedDocumentByIdMock = jest.fn();
  const listOutlineSectionsMock = jest.fn();
  const listParagraphsMock = jest.fn();
  const countParagraphsMock = jest.fn();
  const getTranslationRetryContextMock = jest.fn();
  const markTranslationPendingMock = jest.fn();
  const markTranslationErrorMock = jest.fn();
  const replaceDocumentArtifactsMock = jest.fn();

  const enqueueTranslationRetryMock = jest.fn();

  const buildFromOcrResultMock = jest.fn();

  const readerRepository = {
    listOutlineSections: listOutlineSectionsMock,
    listParagraphs: listParagraphsMock,
    countParagraphs: countParagraphsMock,
    getTranslationRetryContext: getTranslationRetryContextMock,
    markTranslationPending: markTranslationPendingMock,
    markTranslationError: markTranslationErrorMock,
    replaceDocumentArtifacts: replaceDocumentArtifactsMock,
  } as unknown as ReaderRepository;

  const documentsRepository = {
    findOwnedDocumentById: findOwnedDocumentByIdMock,
  } as unknown as DocumentsRepository;

  const queueService = {
    enqueueTranslationRetry: enqueueTranslationRetryMock,
  } as unknown as QueueService;

  const readerArtifactBuilder = {
    buildFromOcrResult: buildFromOcrResultMock,
  } as unknown as ReaderArtifactBuilder;

  const service = new ReaderService(
    readerRepository,
    documentsRepository,
    queueService,
    readerArtifactBuilder,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 422 for outline when document is not ready', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue({
      id: 'doc_1',
      status: 'processing',
      require_translate: true,
    });

    await expect(service.getOutline('doc_1', 'user_1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('lists paragraphs with pagination', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue({
      id: 'doc_1',
      status: 'ready',
      require_translate: true,
    });

    listParagraphsMock.mockResolvedValue([
      {
        id: 'p_1',
        section_id: 's_1',
        order_no: 1,
        page_no: 1,
        source_start: null,
        source_end: null,
        text_raw: 'Text',
        text_raw_md: 'Text',
        source_lang: 'en',
        text_en: 'Text',
        text_en_md: 'Text',
        text_id: 'Teks',
        text_id_md: 'Teks',
        translation_status: 'done',
      },
    ]);
    countParagraphsMock.mockResolvedValue(1);

    const result = await service.listParagraphs({
      documentId: 'doc_1',
      ownerId: 'user_1',
      page: 1,
      limit: 20,
    });

    expect(result.meta.total).toBe(1);
    expect(result.data[0].id).toBe('p_1');
  });

  it('enqueues translation retry and returns pending status', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue({
      id: 'doc_1',
      status: 'ready',
      require_translate: true,
    });

    getTranslationRetryContextMock.mockResolvedValue({
      paragraph_id: 'p_1',
      text_raw: 'Text',
      text_raw_md: 'Text',
      source_lang: 'en',
      status: 'done',
    });

    markTranslationPendingMock.mockResolvedValue(undefined);
    enqueueTranslationRetryMock.mockResolvedValue(undefined);

    const result = await service.enqueueTranslationRetry({
      documentId: 'doc_1',
      paragraphId: 'p_1',
      ownerId: 'user_1',
      requestId: 'req_1',
    });

    expect(result.data.status).toBe('pending');
    expect(enqueueTranslationRetryMock).toHaveBeenCalledWith({
      document_id: 'doc_1',
      paragraph_id: 'p_1',
      actor_id: 'user_1',
      request_id: 'req_1',
    });
  });

  it('fails translation retry when translation is disabled', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue({
      id: 'doc_1',
      status: 'ready',
      require_translate: false,
    });

    await expect(
      service.enqueueTranslationRetry({
        documentId: 'doc_1',
        paragraphId: 'p_1',
        ownerId: 'user_1',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('delegates OCR artifact rebuild', async () => {
    buildFromOcrResultMock.mockReturnValue({
      sections: [],
      paragraphs: [],
      translations: [],
      terms: [],
      term_occurrences: [],
      map_nodes: [],
      warnings: [],
    });
    replaceDocumentArtifactsMock.mockResolvedValue(undefined);

    await service.rebuildArtifactsFromOcrResult(
      'doc_1',
      { pages: [] },
      true,
      'en',
    );

    expect(buildFromOcrResultMock).toHaveBeenCalledWith(
      'doc_1',
      { pages: [] },
      true,
      'en',
    );
    expect(replaceDocumentArtifactsMock).toHaveBeenCalledTimes(1);
  });

  it('returns not found when missing document ownership', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue(null);

    await expect(service.getOutline('doc_1', 'user_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
