import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { BunnyStreamService } from '../../../infrastructure/video-delivery/bunny-stream.service';
import { MetricsService } from '../../../observability/metrics.service';
import { DocumentsService } from '../../documents/documents.service';
import { VideoJobsRepository } from '../video-jobs.repository';
import { VideoJobsService } from '../video-jobs.service';

function createVideoJobRecord(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: 'vjob_1',
    document_id: 'doc_1',
    owner_id: 'user_1',
    status: 'queued',
    pipeline_stage: 'queued',
    progress_pct: 0,
    target_duration_sec: 60,
    voice: 'alloy',
    language: 'en',
    retry_count: 0,
    current_attempt: 1,
    current_scene_index: null,
    fallback_used_count: 0,
    render_profile: '720p',
    worker_id: null,
    accepted_at: null,
    last_heartbeat_at: null,
    lease_expires_at: null,
    terminal_event_id: null,
    quality_gate: {
      storyboard_valid: false,
      audio_ready: false,
      render_valid: false,
    },
    error_code: null,
    error_message: null,
    final_video_object_key: null,
    final_thumbnail_object_key: null,
    bunny_library_id: null,
    bunny_video_id: null,
    bunny_status: null,
    duration_sec: null,
    resolution: null,
    created_at: new Date('2026-03-11T00:00:00.000Z'),
    updated_at: new Date('2026-03-11T00:00:00.000Z'),
    completed_at: null,
    ...overrides,
  };
}

describe('VideoJobsService', () => {
  const findLatestActiveOwnedJobByDocumentIdMock = jest.fn();
  const findLatestCompletedOwnedJobByDocumentIdMock = jest.fn();
  const createVideoJobMock = jest.fn();
  const findOwnedVideoJobByIdMock = jest.fn();
  const findVideoJobByIdMock = jest.fn();
  const resetVideoJobForRetryMock = jest.fn();
  const markVideoJobAcceptedMock = jest.fn();
  const touchVideoJobHeartbeatMock = jest.fn();
  const updateVideoJobProgressMock = jest.fn();
  const upsertSceneMock = jest.fn();
  const markVideoJobCompletedMock = jest.fn();
  const markVideoJobCompletedFromStorageMock = jest.fn();
  const markVideoJobStreamProcessingMock = jest.fn();
  const updateBunnyStreamStatusMock = jest.fn();
  const markVideoJobFailedMock = jest.fn();
  const addArtifactsMock = jest.fn();
  const findStalledJobsMock = jest.fn();
  const failStalledJobMock = jest.fn();

  const assertOwnedDocumentReadyMock = jest.fn();
  const enqueueVideoGenerateMock = jest.fn();

  const repository = {
    findLatestActiveOwnedJobByDocumentId:
      findLatestActiveOwnedJobByDocumentIdMock,
    findLatestCompletedOwnedJobByDocumentId:
      findLatestCompletedOwnedJobByDocumentIdMock,
    createVideoJob: createVideoJobMock,
    findOwnedVideoJobById: findOwnedVideoJobByIdMock,
    findVideoJobById: findVideoJobByIdMock,
    resetVideoJobForRetry: resetVideoJobForRetryMock,
    markVideoJobAccepted: markVideoJobAcceptedMock,
    touchVideoJobHeartbeat: touchVideoJobHeartbeatMock,
    updateVideoJobProgress: updateVideoJobProgressMock,
    upsertScene: upsertSceneMock,
    markVideoJobCompleted: markVideoJobCompletedMock,
    markVideoJobCompletedFromStorage: markVideoJobCompletedFromStorageMock,
    markVideoJobStreamProcessing: markVideoJobStreamProcessingMock,
    updateBunnyStreamStatus: updateBunnyStreamStatusMock,
    markVideoJobFailed: markVideoJobFailedMock,
    addArtifacts: addArtifactsMock,
    findStalledJobs: findStalledJobsMock,
    failStalledJob: failStalledJobMock,
    getSceneCounts: jest.fn(),
  } as unknown as VideoJobsRepository;

  const documentsService = {
    assertOwnedDocumentReady: assertOwnedDocumentReadyMock,
  } as unknown as DocumentsService;

  const queueService = {
    enqueueVideoGenerate: enqueueVideoGenerateMock,
  };

  const storageService = {
    createObjectUrl: jest.fn(),
    createDocumentOcrArtifactKey: jest
      .fn()
      .mockImplementation(
        (documentId: string) =>
          `documents/${documentId}/artifacts/ocr/raw.json`,
      ),
    getObject: jest.fn(),
  } as unknown as StorageService;

  const bunnyStreamService = {
    isConfigured: jest.fn().mockReturnValue(false),
    createVideo: jest.fn(),
    uploadVideo: jest.fn(),
    getVideo: jest.fn(),
    buildEmbedUrl: jest
      .fn()
      .mockImplementation(
        (videoId: string, libraryId: string) =>
          `https://player.mediadelivery.net/embed/${libraryId}/${videoId}`,
      ),
  } as unknown as BunnyStreamService;

  const configService = {
    get: jest.fn((key: string, fallback?: number) => {
      if (key === 'VIDEO_AUTO_RETRY_MAX_ATTEMPTS') {
        return 3;
      }
      if (key === 'VIDEO_WORKER_LEASE_TTL_MS') {
        return 45_000;
      }
      return fallback;
    }),
  } as unknown as ConfigService;

  const metricsService = {
    recordVideoJobCallback: jest.fn(),
    observeVideoJobStageElapsed: jest.fn(),
    recordVideoJobSceneEvent: jest.fn(),
    recordVideoJobFallback: jest.fn(),
  } as unknown as MetricsService;

  const service = new VideoJobsService(
    repository,
    documentsService,
    queueService as never,
    storageService,
    bunnyStreamService,
    configService,
    metricsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findLatestCompletedOwnedJobByDocumentIdMock.mockResolvedValue(null);
    (bunnyStreamService.isConfigured as jest.Mock).mockReturnValue(false);
  });

  it('creates a job and enqueues it directly to bullmq', async () => {
    const created = createVideoJobRecord({
      id: 'vjob_2',
      document_id: 'doc_1',
      owner_id: 'user_1',
      target_duration_sec: 75,
      voice: 'nova',
      language: 'id',
    });

    assertOwnedDocumentReadyMock.mockResolvedValue({
      id: 'doc_1',
      require_video_generation: true,
    });
    findLatestActiveOwnedJobByDocumentIdMock.mockResolvedValue(null);
    findLatestCompletedOwnedJobByDocumentIdMock.mockResolvedValue(null);
    createVideoJobMock.mockResolvedValue(created);
    enqueueVideoGenerateMock.mockResolvedValue(undefined);

    await expect(
      service.createVideoJob({
        ownerId: 'user_1',
        document_id: 'doc_1',
        target_duration_sec: 75,
        voice: 'nova',
        language: 'id',
        requestId: 'req_1',
      }),
    ).resolves.toEqual({
      data: expect.objectContaining({
        id: 'vjob_2',
        target_duration_sec: 75,
        voice: 'nova',
        language: 'id',
      }),
    });

    expect(enqueueVideoGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        video_job_id: 'vjob_2',
        attempt: 1,
        request_id: 'req_1',
      }),
      expect.objectContaining({
        delayMs: 0,
      }),
    );
  });

  it('retries only failed jobs and re-enqueues via bullmq', async () => {
    resetVideoJobForRetryMock.mockResolvedValue(undefined);
    assertOwnedDocumentReadyMock.mockResolvedValue({
      id: 'doc_1',
      require_video_generation: true,
    });
    findOwnedVideoJobByIdMock.mockResolvedValueOnce(
      createVideoJobRecord({
        id: 'vjob_3',
        status: 'failed',
        retry_count: 1,
      }),
    );
    findVideoJobByIdMock.mockResolvedValue(
      createVideoJobRecord({
        id: 'vjob_3',
        status: 'queued',
        retry_count: 2,
        current_attempt: 2,
      }),
    );
    findOwnedVideoJobByIdMock.mockResolvedValueOnce(
      createVideoJobRecord({
        id: 'vjob_3',
        status: 'queued',
        retry_count: 2,
        current_attempt: 2,
      }),
    );

    await service.retryVideoJob('vjob_3', 'user_1', 'req_retry');

    expect(resetVideoJobForRetryMock).toHaveBeenCalledWith('vjob_3');
    expect(enqueueVideoGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        video_job_id: 'vjob_3',
        attempt: 2,
        request_id: 'req_retry',
      }),
      expect.objectContaining({
        delayMs: 0,
      }),
    );
  });

  it('rejects retry when the job is not failed', async () => {
    findOwnedVideoJobByIdMock.mockResolvedValue(
      createVideoJobRecord({
        id: 'vjob_4',
        status: 'processing',
      }),
    );

    await expect(
      service.retryVideoJob('vjob_4', 'user_1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects creating a new job when the document already has a completed video', async () => {
    assertOwnedDocumentReadyMock.mockResolvedValue({
      id: 'doc_1',
      require_video_generation: true,
    });
    findLatestActiveOwnedJobByDocumentIdMock.mockResolvedValue(null);
    findLatestCompletedOwnedJobByDocumentIdMock.mockResolvedValue(
      createVideoJobRecord({
        id: 'vjob_done',
        status: 'completed',
        completed_at: new Date('2026-03-11T01:00:00.000Z'),
      }),
    );

    await expect(
      service.createVideoJob({
        ownerId: 'user_1',
        document_id: 'doc_1',
        requestId: 'req_blocked',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: 'Video already generated for document',
      }),
    );

    expect(createVideoJobMock).not.toHaveBeenCalled();
  });

  it('publishes completed worker output to Bunny Stream when configured', async () => {
    (bunnyStreamService.isConfigured as jest.Mock).mockReturnValue(true);
    findVideoJobByIdMock.mockResolvedValue(
      createVideoJobRecord({
        id: 'vjob_publish',
        status: 'processing',
        pipeline_stage: 'uploading',
      }),
    );
    (storageService.getObject as jest.Mock).mockResolvedValue({
      ContentType: 'video/mp4',
      Body: {
        transformToByteArray: jest
          .fn()
          .mockResolvedValue(new Uint8Array([1, 2, 3])),
      },
    });
    (bunnyStreamService.createVideo as jest.Mock).mockResolvedValue({
      libraryId: '12345',
      videoId: 'video-guid',
      status: 2,
    });
    (bunnyStreamService.uploadVideo as jest.Mock).mockResolvedValue(undefined);

    await service.applyInternalComplete('vjob_publish', {
      final_video_object_key: 'videos/vjob_publish/final.mp4',
      duration_sec: 61.2,
      resolution: '1280x720',
      artifact_keys: ['videos/vjob_publish/artifacts/merge.log'],
    });

    expect(bunnyStreamService.uploadVideo).toHaveBeenCalledWith(
      'video-guid',
      new Uint8Array([1, 2, 3]),
      'video/mp4',
    );
    expect(markVideoJobStreamProcessingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'vjob_publish',
        bunnyLibraryId: '12345',
        bunnyVideoId: 'video-guid',
        finalVideoObjectKey: 'videos/vjob_publish/final.mp4',
      }),
    );
    expect(addArtifactsMock).toHaveBeenCalledWith('vjob_publish', [
      'videos/vjob_publish/artifacts/merge.log',
    ]);
  });

  it('returns Bunny embed playback URL for completed streamed jobs', async () => {
    findOwnedVideoJobByIdMock.mockResolvedValue(
      createVideoJobRecord({
        id: 'vjob_done',
        status: 'completed',
        pipeline_stage: 'completed',
        bunny_library_id: '12345',
        bunny_video_id: 'video-guid',
        bunny_status: 4,
        duration_sec: 61.2,
        resolution: '1280x720',
      }),
    );

    await expect(
      service.getVideoJobResult('vjob_done', 'user_1'),
    ).resolves.toEqual({
      data: expect.objectContaining({
        video_job_id: 'vjob_done',
        video_url:
          'https://player.mediadelivery.net/embed/12345/video-guid',
        embed_url:
          'https://player.mediadelivery.net/embed/12345/video-guid',
        playback_status: 'playable',
      }),
    });
  });

  it('marks stalled jobs as failed when no attempts remain', async () => {
    findStalledJobsMock.mockResolvedValue([
      {
        id: 'vjob_stalled',
        document_id: 'doc_1',
        owner_id: 'user_1',
        retry_count: 2,
        current_attempt: 3,
        target_duration_sec: 60,
        voice: 'alloy',
        language: 'en',
        render_profile: '720p',
      },
    ]);

    await expect(service.recoverStalledJobs()).resolves.toBe(1);

    expect(failStalledJobMock).toHaveBeenCalledWith(
      'vjob_stalled',
      'Video worker lease expired before a terminal event was received',
    );
  });
});
