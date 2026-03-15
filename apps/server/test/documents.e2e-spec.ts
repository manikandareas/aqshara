import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { of } from 'rxjs';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ClerkAuthService } from '../src/modules/auth/clerk-auth.service';
import { DocumentsService } from '../src/modules/documents/documents.service';

describe('Documents Routes (e2e)', () => {
  let app: INestApplication<App>;

  const listDocumentsMock = jest.fn();
  const getDocumentMock = jest.fn();
  const deleteDocumentMock = jest.fn();
  const uploadDocumentMock = jest.fn();
  const getDocumentStatusMock = jest.fn();
  const streamDocumentStatusMock = jest.fn();

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
      .overrideProvider(DocumentsService)
      .useValue({
        listDocuments: listDocumentsMock,
        getDocument: getDocumentMock,
        deleteDocument: deleteDocumentMock,
        uploadDocument: uploadDocumentMock,
        getDocumentStatus: getDocumentStatusMock,
        streamDocumentStatus: streamDocumentStatusMock,
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

  it('GET /api/v1/documents returns list envelope', async () => {
    listDocumentsMock.mockResolvedValue({
      data: [
        {
          id: 'doc_1',
          filename: 'paper.pdf',
          status: 'processing',
          pipeline_stage: 'queued',
          require_translate: true,
          require_video_generation: false,
          page_count: null,
          created_at: '2026-03-09T00:00:00.000Z',
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/documents?page=1&limit=20&status=processing')
      .set('Authorization', 'Bearer token_1')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          data: unknown[];
          meta: { total: number };
        };
        expect(body.data).toHaveLength(1);
        expect(body.meta.total).toBe(1);
      });

    expect(listDocumentsMock).toHaveBeenCalledWith({
      ownerId: 'user_e2e',
      page: 1,
      limit: 20,
      status: 'processing',
    });
  });

  it('GET /api/v1/documents/:id returns 404 when missing', async () => {
    getDocumentMock.mockRejectedValue(
      new NotFoundException('Document not found'),
    );

    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_missing')
      .set('Authorization', 'Bearer token_1')
      .expect(404)
      .expect((res) => {
        const body = res.body as { error: { code: string } };
        expect(body.error.code).toBe('NOT_FOUND');
      });
  });

  it('GET /api/v1/documents/:id returns detail with video summary', async () => {
    getDocumentMock.mockResolvedValue({
      data: {
        id: 'doc_1',
        filename: 'paper.pdf',
        status: 'ready',
        pipeline_stage: 'completed',
        require_translate: true,
        require_video_generation: true,
        source_lang: 'en',
        page_count: 12,
        title: 'Paper title',
        abstract: 'Paper abstract',
        pdf_type: 'article',
        ocr_quality: 0.98,
        processed_at: '2026-03-09T01:00:00.000Z',
        video: {
          job_id: 'vjob_1',
          status: 'completed',
          pipeline_stage: 'completed',
          progress_pct: 100,
          video_url: 'https://player.mediadelivery.net/embed/12345/video-guid',
          playback_status: 'playable',
          thumbnail_url: null,
          completed_at: '2026-03-09T02:00:00.000Z',
        },
        created_at: '2026-03-09T00:00:00.000Z',
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_1')
      .set('Authorization', 'Bearer token_1')
      .expect(200)
      .expect((res) => {
        expect(res.body.data.video.job_id).toBe('vjob_1');
        expect(res.body.data.video.video_url).toContain(
          '/embed/12345/video-guid',
        );
      });
  });

  it('DELETE /api/v1/documents/:id returns 204', async () => {
    deleteDocumentMock.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/documents/doc_1')
      .set('Authorization', 'Bearer token_1')
      .expect(204);

    expect(deleteDocumentMock).toHaveBeenCalledWith('doc_1', 'user_e2e');
  });

  it('POST /api/v1/documents uploads multipart and returns 202', async () => {
    uploadDocumentMock.mockResolvedValue({
      data: {
        id: 'doc_2',
        filename: 'uploaded.pdf',
        status: 'processing',
        pipeline_stage: 'queued',
        require_translate: true,
        require_video_generation: true,
        page_count: null,
        created_at: '2026-03-09T00:00:00.000Z',
      },
    });

    const pdfBytes = Buffer.from('%PDF-1.4\n%mock\n', 'utf8');

    await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', 'Bearer token_1')
      .field('require_translate', 'true')
      .field('require_video_generation', 'true')
      .attach('file', pdfBytes, {
        filename: 'uploaded.pdf',
        contentType: 'application/pdf',
      })
      .expect(202)
      .expect((res) => {
        const body = res.body as { data: { id: string } };
        expect(body.data.id).toBe('doc_2');
      });

    expect(uploadDocumentMock).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/documents/:id/status returns status payload', async () => {
    getDocumentStatusMock.mockResolvedValue({
      data: {
        document_id: 'doc_1',
        status: 'processing',
        pipeline_stage: 'extracting',
        stages: [],
        warnings: [],
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_1/status')
      .set('Authorization', 'Bearer token_1')
      .expect(200)
      .expect((res) => {
        const body = res.body as { data: { document_id: string } };
        expect(body.data.document_id).toBe('doc_1');
      });
  });

  it('GET /api/v1/documents/:id/status/stream accepts access_token query auth', async () => {
    streamDocumentStatusMock.mockReturnValue(
      of({
        type: 'status',
        data: {
          document_id: 'doc_1',
          status: 'processing',
          pipeline_stage: 'queued',
          stages: [],
          warnings: [],
        },
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_1/status/stream?access_token=stream_token')
      .expect(200)
      .expect('Content-Type', /text\/event-stream/)
      .expect((res) => {
        expect(res.text).toContain('event: status');
      });

    expect(authenticateMock).toHaveBeenCalled();
  });

  it('GET /api/v1/documents is unauthorized without auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/documents').expect(401);
  });

  it('GET /api/v1/documents returns 400 with query validation messages', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/documents?page=0&limit=500&status=bad_status')
      .set('Authorization', 'Bearer token_1')
      .expect(400)
      .expect((res) => {
        const body = res.body as { error: { message: string | string[] } };
        expect(Array.isArray(body.error.message)).toBe(true);
        expect(body.error.message).toEqual(
          expect.arrayContaining([
            expect.stringContaining('page'),
            expect.stringContaining('limit'),
            expect.stringContaining('status'),
          ]),
        );
      });

    expect(listDocumentsMock).not.toHaveBeenCalled();
  });
});
