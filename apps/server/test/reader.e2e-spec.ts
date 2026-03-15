import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ClerkAuthService } from '../src/modules/auth/clerk-auth.service';
import { ReaderService } from '../src/modules/reader/reader.service';

describe('Reader Routes (e2e)', () => {
  let app: INestApplication<App>;

  const getOutlineMock = jest.fn();
  const listParagraphsMock = jest.fn();
  const getParagraphDetailMock = jest.fn();
  const searchParagraphsMock = jest.fn();
  const listTranslationsMock = jest.fn();
  const listGlossaryMock = jest.fn();
  const getGlossaryTermMock = jest.fn();
  const lookupGlossaryTermMock = jest.fn();
  const getMapTreeMock = jest.fn();
  const getMapNodeDetailMock = jest.fn();
  const enqueueTranslationRetryMock = jest.fn();

  const authenticateMock = jest.fn(
    (req: { headers?: { authorization?: string } }) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing bearer token');
      }

      return Promise.resolve({
        userId: 'user_reader',
        sessionId: 'sess_reader',
        orgId: null,
      });
    },
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ReaderService)
      .useValue({
        getOutline: getOutlineMock,
        listParagraphs: listParagraphsMock,
        getParagraphDetail: getParagraphDetailMock,
        searchParagraphs: searchParagraphsMock,
        listTranslations: listTranslationsMock,
        listGlossary: listGlossaryMock,
        getGlossaryTerm: getGlossaryTermMock,
        lookupGlossaryTerm: lookupGlossaryTermMock,
        getMapTree: getMapTreeMock,
        getMapNodeDetail: getMapNodeDetailMock,
        enqueueTranslationRetry: enqueueTranslationRetryMock,
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

  it('GET /api/v1/documents/:id/outline returns data', async () => {
    getOutlineMock.mockResolvedValue({
      data: {
        sections: [],
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_1/outline')
      .set('Authorization', 'Bearer token_1')
      .expect(200)
      .expect((res) => {
        expect(
          Array.isArray(
            (res.body as { data: { sections: unknown[] } }).data.sections,
          ),
        ).toBe(true);
      });
  });

  it('GET /api/v1/documents/:id/paragraphs returns list envelope', async () => {
    listParagraphsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
    });

    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_1/paragraphs?page=1&limit=20&lang=en')
      .set('Authorization', 'Bearer token_1')
      .expect(200);
  });

  it('GET /api/v1/documents/:id/outline returns 422 when not ready', async () => {
    getOutlineMock.mockRejectedValue(
      new UnprocessableEntityException(
        'Document is not ready for reader queries',
      ),
    );

    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_1/outline')
      .set('Authorization', 'Bearer token_1')
      .expect(422);
  });

  it('POST /api/v1/documents/:id/translations/:paragraphId/retry returns 202', async () => {
    enqueueTranslationRetryMock.mockResolvedValue({
      data: {
        paragraph_id: 'p_1',
        status: 'pending',
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/documents/doc_1/translations/p_1/retry')
      .set('Authorization', 'Bearer token_1')
      .expect(202);
  });

  it('GET /api/v1/documents/:id/map/:nodeId returns 404 when missing', async () => {
    getMapNodeDetailMock.mockRejectedValue(
      new NotFoundException('Map node not found'),
    );

    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_1/map/node_404')
      .set('Authorization', 'Bearer token_1')
      .expect(404);
  });

  it('reader routes are unauthorized without bearer token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_1/outline')
      .expect(401);
  });

  it('GET /api/v1/documents/:id/paragraphs returns 400 with query validation messages', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/documents/doc_1/paragraphs?page=0')
      .set('Authorization', 'Bearer token_1')
      .expect(400)
      .expect((res) => {
        const body = res.body as { error: { message: string | string[] } };
        expect(Array.isArray(body.error.message)).toBe(true);
        expect(body.error.message).toEqual(
          expect.arrayContaining([expect.stringContaining('page')]),
        );
      });

    expect(listParagraphsMock).not.toHaveBeenCalled();
  });
});
