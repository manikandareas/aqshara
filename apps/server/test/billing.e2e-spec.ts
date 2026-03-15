import {
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ClerkAuthService } from '../src/modules/auth/clerk-auth.service';
import { BillingService } from '../src/modules/billing/billing.service';
import { BillingWebhookService } from '../src/modules/billing/billing-webhook.service';

describe('Billing Routes (e2e)', () => {
  let app: INestApplication<App>;

  const listPlansMock = jest.fn();
  const getMyBillingMock = jest.fn();
  const createCheckoutMock = jest.fn();
  const createPortalSessionMock = jest.fn();

  const handlePolarWebhookMock = jest.fn();
  const isWebhookVerificationErrorMock = jest.fn();

  const authenticateMock = jest.fn(
    (req: { headers?: { authorization?: string } }) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing bearer token');
      }

      return Promise.resolve({
        userId: 'user_billing',
        sessionId: 'sess_billing',
        orgId: null,
      });
    },
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BillingService)
      .useValue({
        listPlans: listPlansMock,
        getMyBilling: getMyBillingMock,
        createCheckout: createCheckoutMock,
        createPortalSession: createPortalSessionMock,
      })
      .overrideProvider(BillingWebhookService)
      .useValue({
        handlePolarWebhook: handlePolarWebhookMock,
        isWebhookVerificationError: isWebhookVerificationErrorMock,
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

  it('GET /api/v1/billing/plans returns billing plans', async () => {
    listPlansMock.mockResolvedValue({
      data: [
        {
          id: 'plan_1',
          code: 'pro',
          name: 'Pro',
          description: '',
          price_amount: 9900,
          price_currency: 'USD',
          interval: 'month',
        },
      ],
    });

    await request(app.getHttpServer())
      .get('/api/v1/billing/plans')
      .set('Authorization', 'Bearer token_1')
      .expect(200)
      .expect((res) => {
        expect((res.body as { data: unknown[] }).data).toHaveLength(1);
      });
  });

  it('GET /api/v1/billing/me returns user billing snapshot', async () => {
    getMyBillingMock.mockResolvedValue({
      data: {
        customer_id: 'cust_1',
        subscription: null,
        usage: {
          period_key: '2026-03',
          used_units: 0,
          held_units: 0,
        },
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/billing/me')
      .set('Authorization', 'Bearer token_1')
      .expect(200);

    expect(getMyBillingMock).toHaveBeenCalledWith('user_billing');
  });

  it('POST /api/v1/billing/checkout maps provider failure to 503 envelope', async () => {
    createCheckoutMock.mockRejectedValue(
      new ServiceUnavailableException('provider unavailable'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/billing/checkout')
      .set('Authorization', 'Bearer token_1')
      .send({
        plan_code: 'pro',
        success_url: 'https://app.example.com/success',
      })
      .expect(503)
      .expect((res) => {
        expect((res.body as { error: { code: string } }).error.code).toBe(
          'INTERNAL_ERROR',
        );
      });
  });

  it('POST /api/v1/billing/portal returns 404 for missing customer', async () => {
    createPortalSessionMock.mockRejectedValue(
      new NotFoundException('Billing customer not found'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/billing/portal')
      .set('Authorization', 'Bearer token_1')
      .send({ return_url: 'https://app.example.com/settings' })
      .expect(404);
  });

  it('POST /api/v1/billing/checkout returns 400 with validation messages', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/billing/checkout')
      .set('Authorization', 'Bearer token_1')
      .send({
        plan_code: '',
        success_url: '',
      })
      .expect(400)
      .expect((res) => {
        const body = res.body as { error: { message: string | string[] } };
        expect(Array.isArray(body.error.message)).toBe(true);
        expect(body.error.message).toEqual(
          expect.arrayContaining([
            expect.stringContaining('plan_code'),
            expect.stringContaining('success_url'),
          ]),
        );
      });

    expect(createCheckoutMock).not.toHaveBeenCalled();
  });

  it('POST /api/v1/webhooks/polar is public and returns 202 on valid webhook', async () => {
    isWebhookVerificationErrorMock.mockReturnValue(false);
    handlePolarWebhookMock.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/polar')
      .set('content-type', 'application/json')
      .send({ mock: true })
      .expect(202);

    expect(handlePolarWebhookMock).toHaveBeenCalledTimes(1);
  });

  it('billing routes are unauthorized without bearer token', async () => {
    await request(app.getHttpServer()).get('/api/v1/billing/plans').expect(401);
  });
});
