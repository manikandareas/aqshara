import { NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService } from '../../../infrastructure/queue/queue.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { BunnyStreamService } from '../../../infrastructure/video-delivery/bunny-stream.service';
import { DocumentsRepository } from '../documents.repository';
import { DocumentsService } from '../documents.service';
import type { UploadDocumentFile } from '../documents.service';

describe('DocumentsService', () => {
  const listOwnedDocumentsMock = jest.fn();
  const findOwnedDocumentByIdMock = jest.fn();
  const deleteOwnedDocumentMock = jest.fn();
  const createDocumentWithMetadataMock = jest.fn();
  const listStageRunsMock = jest.fn();
  const findOwnedDocumentVideoSummaryMock = jest.fn();
  const createDocumentSourceKeyMock = jest.fn();
  const createObjectUrlMock = jest.fn();
  const uploadObjectMock = jest.fn();
  const deleteObjectMock = jest.fn();
  const enqueueDocumentProcessMock = jest.fn();

  const documentsRepository = {
    listOwnedDocuments: listOwnedDocumentsMock,
    findOwnedDocumentById: findOwnedDocumentByIdMock,
    findOwnedDocumentVideoSummary: findOwnedDocumentVideoSummaryMock,
    deleteOwnedDocument: deleteOwnedDocumentMock,
    createDocumentWithMetadata: createDocumentWithMetadataMock,
    listStageRuns: listStageRunsMock,
  } as unknown as DocumentsRepository;

  const storageService = {
    createDocumentSourceKey: createDocumentSourceKeyMock,
    createObjectUrl: createObjectUrlMock,
    uploadObject: uploadObjectMock,
    deleteObject: deleteObjectMock,
  } as unknown as StorageService;

  const queueService = {
    enqueueDocumentProcess: enqueueDocumentProcessMock,
  } as unknown as QueueService;

  const bunnyStreamService = {
    buildEmbedUrl: jest
      .fn()
      .mockImplementation(
        (videoId: string, libraryId: string) =>
          `https://player.mediadelivery.net/embed/${libraryId}/${videoId}`,
      ),
  } as unknown as BunnyStreamService;

  const configService = {
    get: jest.fn().mockReturnValue(52_428_800),
  } as unknown as ConfigService;

  const service = new DocumentsService(
    configService,
    documentsRepository,
    storageService,
    bunnyStreamService,
    queueService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    createObjectUrlMock.mockImplementation(
      (key: string) => `https://cdn.local/${key}`,
    );
  });

  it('lists documents and maps payload fields', async () => {
    listOwnedDocumentsMock.mockResolvedValue({
      rows: [
        {
          id: 'doc_1',
          filename: 'paper.pdf',
          status: 'ready',
          pipeline_stage: 'completed',
          require_translate: true,
          require_video_generation: false,
          source_lang: 'id',
          page_count: 12,
          created_at: new Date('2026-03-10T00:00:00.000Z'),
        },
      ],
      total: 1,
    });

    await expect(
      service.listDocuments({
        ownerId: 'user_1',
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      data: [
        {
          id: 'doc_1',
          filename: 'paper.pdf',
          status: 'ready',
          pipeline_stage: 'completed',
          require_translate: true,
          require_video_generation: false,
          source_lang: 'id',
          page_count: 12,
          created_at: '2026-03-10T00:00:00.000Z',
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
      },
    });
  });

  it('rejects oversized uploads', async () => {
    const file: UploadDocumentFile = {
      originalname: 'doc.pdf',
      size: 60_000_000,
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-test'),
    };

    await expect(
      service.uploadDocument({
        ownerId: 'user_1',
        file,
        requireTranslate: false,
        requireVideoGeneration: false,
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('returns document detail with video summary when a video job exists', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue({
      id: 'doc_1',
      filename: 'paper.pdf',
      status: 'ready',
      pipeline_stage: 'completed',
      require_translate: false,
      require_video_generation: true,
      source_lang: 'en',
      page_count: 10,
      title: 'Paper title',
      abstract: 'Paper abstract',
      pdf_type: 'article',
      ocr_quality: 0.98,
      processed_at: new Date('2026-03-10T01:00:00.000Z'),
      created_at: new Date('2026-03-10T00:00:00.000Z'),
    });
    findOwnedDocumentVideoSummaryMock.mockResolvedValue({
      job_id: 'vjob_1',
      status: 'completed',
      pipeline_stage: 'completed',
      progress_pct: 100,
      final_video_object_key: 'videos/vjob_1/final.mp4',
      final_thumbnail_object_key: 'videos/vjob_1/thumb.jpg',
      bunny_library_id: '12345',
      bunny_video_id: 'video-guid',
      bunny_status: 4,
      completed_at: new Date('2026-03-10T02:00:00.000Z'),
    });

    await expect(service.getDocument('doc_1', 'user_1')).resolves.toEqual({
      data: {
        id: 'doc_1',
        filename: 'paper.pdf',
        status: 'ready',
        pipeline_stage: 'completed',
        require_translate: false,
        require_video_generation: true,
        source_lang: 'en',
        page_count: 10,
        title: 'Paper title',
        abstract: 'Paper abstract',
        pdf_type: 'article',
        ocr_quality: 0.98,
        processed_at: '2026-03-10T01:00:00.000Z',
        video: {
          job_id: 'vjob_1',
          status: 'completed',
          pipeline_stage: 'completed',
          progress_pct: 100,
          video_url: 'https://player.mediadelivery.net/embed/12345/video-guid',
          playback_status: 'playable',
          thumbnail_url: 'https://cdn.local/videos/vjob_1/thumb.jpg',
          completed_at: '2026-03-10T02:00:00.000Z',
        },
        created_at: '2026-03-10T00:00:00.000Z',
      },
    });
  });

  it('compensates storage/object when queue enqueue fails', async () => {
    createDocumentSourceKeyMock.mockReturnValue('documents/doc/source/doc.pdf');
    uploadObjectMock.mockResolvedValue(undefined);
    createDocumentWithMetadataMock.mockResolvedValue(undefined);
    enqueueDocumentProcessMock.mockRejectedValue(new Error('queue down'));
    deleteOwnedDocumentMock.mockResolvedValue(true);
    deleteObjectMock.mockResolvedValue(undefined);

    const file: UploadDocumentFile = {
      originalname: 'doc.pdf',
      size: 128,
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-test'),
    };

    await expect(
      service.uploadDocument({
        ownerId: 'user_1',
        file,
        requireTranslate: false,
        requireVideoGeneration: false,
        requestId: 'req_1',
      }),
    ).rejects.toThrow('queue down');

    expect(deleteObjectMock).toHaveBeenCalledTimes(1);
    expect(deleteOwnedDocumentMock).toHaveBeenCalledTimes(1);
  });

  it('returns not found for missing status document', async () => {
    findOwnedDocumentByIdMock.mockResolvedValue(null);

    await expect(
      service.getDocumentStatus('doc_1', 'user_1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
