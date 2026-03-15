import { AiService } from '../../../infrastructure/ai/ai.service';
import { MistralOcrService } from '../../../infrastructure/ocr/mistral-ocr.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { DocumentsService } from '../../documents/documents.service';
import { ReaderService } from '../../reader/reader.service';
import { VideoJobsService } from '../../video-jobs/video-jobs.service';
import { PipelineDocumentProcessorService } from '../pipeline-document-processor.service';

describe('PipelineDocumentProcessorService', () => {
  const getPipelineProcessingContextMock = jest.fn();
  const startPipelineStageMock = jest.fn();
  const completePipelineStageMock = jest.fn();
  const markPipelineStageDoneMock = jest.fn();
  const failPipelineAttemptMock = jest.fn();
  const failPipelineTerminalMock = jest.fn();
  const setDocumentSourceLanguageMock = jest.fn();

  const getObjectMock = jest.fn();
  const createDocumentOcrArtifactKeyMock = jest.fn();
  const uploadObjectMock = jest.fn();
  const rebuildArtifactsFromOcrResultMock = jest.fn();
  const enqueueInitialTranslationJobsMock = jest.fn();

  const processPdfMock = jest.fn();
  const detectSourceLanguageMock = jest.fn();
  const ensureAutoVideoJobForReadyDocumentMock = jest.fn();

  const documentsService = {
    getPipelineProcessingContext: getPipelineProcessingContextMock,
    startPipelineStage: startPipelineStageMock,
    completePipelineStage: completePipelineStageMock,
    markPipelineStageDone: markPipelineStageDoneMock,
    failPipelineAttempt: failPipelineAttemptMock,
    failPipelineTerminal: failPipelineTerminalMock,
    setDocumentSourceLanguage: setDocumentSourceLanguageMock,
  } as unknown as DocumentsService;

  const storageService = {
    getObject: getObjectMock,
    createDocumentOcrArtifactKey: createDocumentOcrArtifactKeyMock,
    uploadObject: uploadObjectMock,
  } as unknown as StorageService;

  const mistralOcrService = {
    processPdf: processPdfMock,
  } as unknown as MistralOcrService;

  const readerService = {
    rebuildArtifactsFromOcrResult: rebuildArtifactsFromOcrResultMock,
    enqueueInitialTranslationJobs: enqueueInitialTranslationJobsMock,
  } as unknown as ReaderService;

  const aiService = {
    detectSourceLanguage: detectSourceLanguageMock,
  } as unknown as AiService;

  const videoJobsService = {
    ensureAutoVideoJobForReadyDocument: ensureAutoVideoJobForReadyDocumentMock,
  } as unknown as VideoJobsService;

  const service = new PipelineDocumentProcessorService(
    documentsService,
    readerService,
    storageService,
    mistralOcrService,
    aiService,
    videoJobsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes processing and marks document ready', async () => {
    getPipelineProcessingContextMock.mockResolvedValue({
      id: 'doc_1',
      owner_id: 'user_1',
      filename: 'paper.pdf',
      status: 'processing',
      pipeline_stage: 'queued',
      require_translate: true,
      require_video_generation: true,
      source_object_key: 'documents/doc_1/source/paper.pdf',
    });

    getObjectMock.mockResolvedValue({
      Body: {
        transformToByteArray: () =>
          Promise.resolve(Uint8Array.from(Buffer.from('%PDF'))),
      },
    });

    processPdfMock.mockResolvedValue({
      pages: [{ index: 0 }, { index: 1 }],
    });

    createDocumentOcrArtifactKeyMock.mockReturnValue(
      'documents/doc_1/artifacts/ocr/raw.json',
    );
    uploadObjectMock.mockResolvedValue(undefined);
    rebuildArtifactsFromOcrResultMock.mockResolvedValue(undefined);
    setDocumentSourceLanguageMock.mockResolvedValue(undefined);
    enqueueInitialTranslationJobsMock.mockResolvedValue(undefined);
    detectSourceLanguageMock.mockResolvedValue('en');

    await service.process({
      document_id: 'doc_1',
      actor_id: 'user_1',
      require_translate: true,
      request_id: 'req_1',
    });

    expect(startPipelineStageMock).toHaveBeenCalledWith('doc_1', 'ocr');
    expect(markPipelineStageDoneMock).toHaveBeenCalledWith('doc_1', 'ocr');
    expect(startPipelineStageMock).toHaveBeenNthCalledWith(
      2,
      'doc_1',
      'extract',
    );
    expect(uploadObjectMock).toHaveBeenCalledWith(
      'documents/doc_1/artifacts/ocr/raw.json',
      expect.any(String),
      'application/json',
    );
    expect(rebuildArtifactsFromOcrResultMock).toHaveBeenCalledWith(
      'doc_1',
      expect.any(Object),
      true,
      'en',
    );
    expect(setDocumentSourceLanguageMock).toHaveBeenCalledWith('doc_1', 'en');
    expect(enqueueInitialTranslationJobsMock).toHaveBeenCalledWith({
      documentId: 'doc_1',
      actorId: 'user_1',
      requestId: 'req_1',
    });
    expect(completePipelineStageMock).toHaveBeenCalledWith(
      'doc_1',
      'extract',
      2,
    );
    expect(ensureAutoVideoJobForReadyDocumentMock).toHaveBeenCalledWith({
      documentId: 'doc_1',
      ownerId: 'user_1',
      requestId: 'req_1',
    });
  });

  it('marks failed attempt when OCR processing fails', async () => {
    getPipelineProcessingContextMock.mockResolvedValue({
      id: 'doc_1',
      owner_id: 'user_1',
      filename: 'paper.pdf',
      status: 'processing',
      pipeline_stage: 'queued',
      require_translate: true,
      require_video_generation: false,
      source_object_key: 'documents/doc_1/source/paper.pdf',
    });

    getObjectMock.mockResolvedValue({
      Body: {
        transformToByteArray: () =>
          Promise.resolve(Uint8Array.from(Buffer.from('%PDF'))),
      },
    });

    processPdfMock.mockRejectedValue(new Error('OCR failed'));

    await expect(
      service.process({
        document_id: 'doc_1',
        actor_id: 'user_1',
        require_translate: true,
        request_id: 'req_1',
      }),
    ).rejects.toThrow('OCR failed');

    expect(failPipelineAttemptMock).toHaveBeenCalledWith('doc_1', 'ocr');
  });

  it('processes DLQ by marking terminal error', async () => {
    failPipelineTerminalMock.mockResolvedValue(undefined);

    await service.processDlq({
      document_id: 'doc_1',
      actor_id: 'user_1',
      require_translate: true,
      request_id: 'req_1',
    });

    expect(failPipelineTerminalMock).toHaveBeenCalledWith('doc_1', 'ocr');
  });
});
