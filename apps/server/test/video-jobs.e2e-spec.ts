import {
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { of } from 'rxjs';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ClerkAuthService } from '../src/modules/auth/clerk-auth.service';
import { VideoJobsService } from '../src/modules/video-jobs/video-jobs.service';

describe('Video Jobs Routes (e2e)', () => {
  let app: INestApplication<App>;

  const createVideoJobMock = jest.fn();
  const getVideoJobMock = jest.fn();
  const getVideoJobStatusMock = jest.fn();
  const streamVideoJobStatusMock = jest.fn();
  const retryVideoJobMock = jest.fn();
  const getVideoJobResultMock = jest.fn();
  const applyInternalProgressMock = jest.fn();
  const applyInternalCompleteMock = jest.fn();
  const applyInternalFailMock = jest.fn();

  const authenticateMock = jest.fn(
    (req: { headers?: { authorization?: string } }) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing bearer token');
      }

      return Promise.resolve({
        userId: 'user_e2e',
        sessionId: 'sess_e2e',
        orgId: null,
      });
    },
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(VideoJobsService)
      .useValue({
        createVideoJob: createVideoJobMock,
        getVideoJob: getVideoJobMock,
        getVideoJobStatus: getVideoJobStatusMock,
        streamVideoJobStatus: streamVideoJobStatusMock,
        retryVideoJob: retryVideoJobMock,
        getVideoJobResult: getVideoJobResultMock,
        applyInternalProgress: applyInternalProgressMock,
        applyInternalComplete: applyInternalCompleteMock,
        applyInternalFail: applyInternalFailMock,
      })
      .overrideProvider(ClerkAuthService)
      .useValue({
        authenticate: authenticateMock,
      })
      .compile();

    app = moduleFixture.createNestApplication({
      rawBody: true,
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /api/v1/video-jobs returns 202', async () => {
    createVideoJobMock.mockResolvedValue({
      data: {
        id: 'vjob_1',
        document_id: 'doc_1',
        status: 'queued',
        pipeline_stage: 'queued',
        progress_pct: 0,
        target_duration_sec: 60,
        voice: 'alloy',
        language: 'en',
        retry_count: 0,
        error_code: null,
        error_message: null,
        created_at: '2026-03-11T00:00:00.000Z',
        updated_at: '2026-03-11T00:00:00.000Z',
        completed_at: null,
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/video-jobs')
      .set('Authorization', 'Bearer token_1')
      .send({ document_id: 'doc_1', target_duration_sec: 60 })
      .expect(202)
      .expect((res) => {
        expect(res.body.data.id).toBe('vjob_1');
      });

    expect(createVideoJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'user_e2e',
        document_id: 'doc_1',
      }),
    );
  });

  it('GET /api/v1/video-jobs/:id/status returns status payload', async () => {
    getVideoJobStatusMock.mockResolvedValue({
      data: {
        video_job_id: 'vjob_1',
        status: 'processing',
        pipeline_stage: 'rendering',
        progress_pct: 75,
        current_scene_index: 1,
        fallback_used_count: 0,
        render_profile: '720p',
        quality_gate: {
          storyboard_valid: true,
          audio_ready: true,
          render_valid: false,
        },
        stages: [],
        scenes: { total: 1, done: 0, failed: 0, running: 1, pending: 0 },
        error: null,
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/video-jobs/vjob_1/status')
      .set('Authorization', 'Bearer token_1')
      .expect(200)
      .expect((res) => {
        expect(res.body.data.video_job_id).toBe('vjob_1');
      });
  });

  it('GET /api/v1/video-jobs/:id/status/stream accepts access_token query auth', async () => {
    streamVideoJobStatusMock.mockReturnValue(
      of({
        type: 'status',
        data: {
          video_job_id: 'vjob_1',
          status: 'processing',
          pipeline_stage: 'queued',
          progress_pct: 0,
          current_scene_index: null,
          fallback_used_count: 0,
          render_profile: '720p',
          quality_gate: {
            storyboard_valid: false,
            audio_ready: false,
            render_valid: false,
          },
          stages: [],
          scenes: { total: 0, done: 0, failed: 0, running: 0, pending: 0 },
          error: null,
        },
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/video-jobs/vjob_1/status/stream?access_token=stream_token')
      .expect(200)
      .expect('Content-Type', /text\/event-stream/)
      .expect((res) => {
        expect(res.text).toContain('event: status');
      });
  });

  it('POST /api/v1/internal/video-jobs/:id/progress accepts valid service token', async () => {
    applyInternalProgressMock.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/api/v1/internal/video-jobs/vjob_1/progress')
      .set('x-internal-service-token', 'local-video-internal-token')
      .send({
        pipeline_stage: 'tts_generating',
        progress_pct: 80,
        scene: {
          scene_index: 1,
          status: 'done',
          actual_audio_duration_ms: 1234,
          audio_object_key: 'videos/vjob_1/artifacts/audio/scene-01.wav',
        },
      })
      .expect(204);

    expect(applyInternalProgressMock).toHaveBeenCalledWith(
      'vjob_1',
      {
        pipeline_stage: 'tts_generating',
        progress_pct: 80,
        scene: {
          scene_index: 1,
          status: 'done',
          actual_audio_duration_ms: 1234,
          audio_object_key: 'videos/vjob_1/artifacts/audio/scene-01.wav',
        },
      },
      undefined,
    );
  });

  it('POST /api/v1/internal/video-jobs/:id/progress rejects invalid token', async () => {
    applyInternalProgressMock.mockRejectedValue(
      new ForbiddenException('should not be called'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/internal/video-jobs/vjob_1/progress')
      .set('x-internal-service-token', 'wrong-token')
      .send({
        pipeline_stage: 'rendering',
        progress_pct: 80,
      })
      .expect(403);

    expect(applyInternalProgressMock).not.toHaveBeenCalled();
  });
});
