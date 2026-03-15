import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ClerkAuthService } from '../src/modules/auth/clerk-auth.service';
import { setupSwagger } from '../src/openapi/swagger.setup';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type OpenApiOperation = {
  method: HttpMethod;
  path: string;
  requiresAuth: boolean;
};

const PARAM_REPLACEMENTS: Record<string, string> = {
  '{document_id}': 'doc_1',
  '{paragraph_id}': 'p_1',
  '{term_id}': 'term_1',
  '{node_id}': 'node_1',
};

function normalizePrefix(prefix: string): string {
  return `/${prefix.replace(/^\/+|\/+$/g, '')}`;
}

function materializePath(path: string): string {
  let resolved = path;

  for (const [token, replacement] of Object.entries(PARAM_REPLACEMENTS)) {
    resolved = resolved.replaceAll(token, replacement);
  }

  return resolved.replace(/\{[^}]+\}/g, 'sample');
}

function parseOperationsFromDocument(document: {
  paths?: Record<string, Record<string, { security?: unknown[] }>>;
}): OpenApiOperation[] {
  const operations: OpenApiOperation[] = [];
  const paths = document.paths ?? {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const lower = method.toLowerCase();
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(lower)) {
        continue;
      }

      const security = Array.isArray(operation?.security)
        ? operation.security
        : [];

      operations.push({
        method: lower as HttpMethod,
        path,
        requiresAuth: security.length > 0,
      });
    }
  }

  return operations;
}

describe('OpenAPI Contract Parity', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const authenticateMock = jest.fn(
      (req: { headers?: { authorization?: string } }) => {
        const authHeader = req.headers?.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new UnauthorizedException('Missing bearer token');
        }

        return Promise.resolve({
          userId: 'user_contract',
          sessionId: 'sess_contract',
          orgId: null,
        });
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ClerkAuthService)
      .useValue({
        authenticate: authenticateMock,
      })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalExceptionFilter());
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('all generated OpenAPI operations resolve to implemented routes and auth policy', async () => {
    const specResponse = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    const operations = parseOperationsFromDocument(specResponse.body);
    expect(operations.length).toBeGreaterThan(0);

    const prefix = normalizePrefix(process.env.API_PREFIX ?? 'api/v1');

    for (const operation of operations) {
      const resolvedPath = materializePath(`${prefix}${operation.path}`);
      let req = request(app.getHttpServer())[operation.method](resolvedPath);

      if (
        operation.method === 'post' ||
        operation.method === 'put' ||
        operation.method === 'patch'
      ) {
        req = req.send({});
      }

      const res = await req;

      if (operation.path === '/webhooks/polar') {
        expect(res.status).toBe(403);
        continue;
      }

      if (operation.requiresAuth) {
        expect(res.status).toBe(401);
        continue;
      }

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(404);
    }
  });
});
