import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('Platform Baseline (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  it('/api/v1/healthz (GET)', () => {
    return request(app.getHttpServer()).get('/api/v1/healthz').expect(200);
  });

  it('/api/v1/metrics (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/metrics')
      .expect(200)
      .expect((res) => {
        expect(res.text).toContain('process_cpu_user_seconds_total');
        expect(res.text).toContain('queue_jobs_depth');
      });
  });

  it('returns standardized error envelope for unknown route', () => {
    return request(app.getHttpServer())
      .get('/api/v1/not-found')
      .expect(404)
      .expect((res) => {
        const body = res.body as {
          error: { code: string; request_id?: string };
        };

        expect(body.error.code).toBe('NOT_FOUND');
        expect(body.error.request_id).toBeDefined();
      });
  });

  it('/api/v1/webhooks/polar (POST) is publicly reachable and validates signature', () => {
    return request(app.getHttpServer())
      .post('/api/v1/webhooks/polar')
      .set('content-type', 'application/json')
      .send({ event: 'test' })
      .expect(403)
      .expect((res) => {
        const body = res.body as { error: { code: string } };
        expect(body.error.code).toBe('FORBIDDEN');
      });
  });
});
