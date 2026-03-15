import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ClerkAuthService } from '../src/modules/auth/clerk-auth.service';
import { EngagementService } from '../src/modules/engagement/engagement.service';

describe('Engagement Routes (e2e)', () => {
  let app: INestApplication<App>;

  const createFeedbackMock = jest.fn();
  const ingestEventsMock = jest.fn();

  const authenticateMock = jest.fn(
    (req: { headers?: { authorization?: string } }) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing bearer token');
      }

      return Promise.resolve({
        userId: 'user_engagement',
        sessionId: 'sess_engagement',
        orgId: null,
      });
    },
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EngagementService)
      .useValue({
        createFeedback: createFeedbackMock,
        ingestEvents: ingestEventsMock,
      })
      .overrideProvider(ClerkAuthService)
      .useValue({
        authenticate: authenticateMock,
      })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
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

  it('POST /api/v1/documents/:id/feedback returns 201 with created payload', async () => {
    createFeedbackMock.mockResolvedValue({
      data: {
        id: 'fb_1',
        type: 'rating',
        created_at: '2026-03-10T01:00:00.000Z',
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/documents/doc_1/feedback')
      .set('Authorization', 'Bearer token_1')
      .send({
        type: 'rating',
        rating: 5,
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as { data: { id: string } };
        expect(body.data.id).toBe('fb_1');
      });

    expect(createFeedbackMock).toHaveBeenCalledWith(
      'doc_1',
      'user_engagement',
      {
        type: 'rating',
        rating: 5,
      },
    );
  });

  it('POST /api/v1/events returns accepted count payload', async () => {
    ingestEventsMock.mockResolvedValue({
      data: {
        accepted: 2,
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', 'Bearer token_1')
      .send({
        events: [
          {
            type: 'document.opened',
            timestamp: '2026-03-10T01:00:00.000Z',
            payload: { source: 'reader' },
            document_id: 'doc_1',
          },
          {
            type: 'session.ping',
            timestamp: '2026-03-10T01:01:00.000Z',
            payload: {},
          },
        ],
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as { data: { accepted: number } };
        expect(body.data.accepted).toBe(2);
      });
  });

  it('POST /api/v1/events returns 400 for invalid payload', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', 'Bearer token_1')
      .send({ events: [] })
      .expect(400)
      .expect((res) => {
        const body = res.body as { error: { message: string | string[] } };
        expect(Array.isArray(body.error.message)).toBe(true);
        expect(body.error.message).toEqual(
          expect.arrayContaining([expect.stringContaining('events')]),
        );
      });

    expect(ingestEventsMock).not.toHaveBeenCalled();
  });

  it('POST /api/v1/events returns 404 for ownership failure', async () => {
    ingestEventsMock.mockRejectedValue(
      new NotFoundException('Document not found'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', 'Bearer token_1')
      .send({
        events: [
          {
            type: 'document.opened',
            timestamp: '2026-03-10T01:00:00.000Z',
            payload: {},
            document_id: 'doc_missing',
          },
        ],
      })
      .expect(404);
  });

  it('engagement routes are unauthorized without bearer token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/documents/doc_1/feedback')
      .send({ type: 'rating', rating: 5 })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/events')
      .send({ events: [] })
      .expect(401);
  });
});
