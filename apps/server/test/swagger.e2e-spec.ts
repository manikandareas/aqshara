import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { setupSwagger } from '../src/openapi/swagger.setup';

describe('Swagger Docs (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/docs (GET)', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);
  });

  it('/docs-json (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(res.body?.openapi).toMatch(/^3\./);
    expect(res.body?.paths).toBeDefined();
    expect(res.body?.components?.securitySchemes?.bearer).toBeDefined();
    expect(res.body?.paths?.['/healthz']).toBeUndefined();
    expect(res.body?.paths?.['/readyz']).toBeUndefined();
    expect(res.body?.paths?.['/metrics']).toBeUndefined();
  });
});
