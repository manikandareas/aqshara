import { Test } from '@nestjs/testing';
import type { PoolClient } from 'pg';
import { PolarWebhookService } from '../../../infrastructure/payment-gateway/polar/polar-webhook.service';
import { BillingRepository } from '../billing.repository';
import { BillingWebhookService } from '../billing-webhook.service';

describe('BillingWebhookService', () => {
  let service: BillingWebhookService;

  type EventCallback = (args: {
    client: PoolClient;
    isDuplicateProcessed: boolean;
    event: {
      id: string;
      event_type: string;
      status: 'processing' | 'processed' | 'error' | 'ignored';
      attempt_count: number;
    };
  }) => Promise<void>;

  const billingRepositoryMock = {
    withEventProcessing: jest.fn(),
    markEventProcessed: jest.fn(),
    markEventFailed: jest.fn(),
    upsertPlan: jest.fn(),
    upsertWebhookCustomer: jest.fn(),
    findCustomerIdByUserId: jest.fn(),
    upsertSubscription: jest.fn(),
    ensureUsageCounterPeriod: jest.fn(),
  };

  const polarWebhookServiceMock = {
    validate: jest.fn(),
    isVerificationError: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingWebhookService,
        {
          provide: BillingRepository,
          useValue: billingRepositoryMock,
        },
        {
          provide: PolarWebhookService,
          useValue: polarWebhookServiceMock,
        },
      ],
    }).compile();

    service = moduleRef.get(BillingWebhookService);
  });

  it('marks product.updated event as processed', async () => {
    const client = {} as PoolClient;

    billingRepositoryMock.withEventProcessing.mockImplementation(
      (
        _eventId: string,
        _eventType: string,
        _payload: unknown,
        callback: EventCallback,
      ) =>
        callback({
          client,
          isDuplicateProcessed: false,
          event: {
            id: 'product.updated:prod_1',
            event_type: 'product.updated',
            status: 'processing',
            attempt_count: 1,
          },
        }),
    );

    await service.processWebhookEvent({
      type: 'product.updated',
      timestamp: new Date('2026-03-09T00:00:00.000Z'),
      data: {
        id: 'prod_1',
        name: 'Pro Plan',
        recurringInterval: 'month',
        isArchived: false,
        metadata: { plan_code: 'pro' },
        prices: [
          {
            amountType: 'fixed',
            priceAmount: 9900,
            priceCurrency: 'USD',
            isArchived: false,
          },
        ],
      },
    });

    expect(billingRepositoryMock.upsertPlan).toHaveBeenCalledTimes(1);
    expect(billingRepositoryMock.markEventProcessed.mock.calls[0]).toEqual([
      client,
      'product.updated:prod_1',
      'processed',
    ]);
  });

  it('handles subscription.updated using repository transaction methods', async () => {
    const client = {} as PoolClient;
    billingRepositoryMock.findCustomerIdByUserId.mockResolvedValue(
      'cust_local',
    );

    billingRepositoryMock.withEventProcessing.mockImplementation(
      (
        _eventId: string,
        _eventType: string,
        _payload: unknown,
        callback: EventCallback,
      ) =>
        callback({
          client,
          isDuplicateProcessed: false,
          event: {
            id: 'subscription.updated:sub_1',
            event_type: 'subscription.updated',
            status: 'processing',
            attempt_count: 1,
          },
        }),
    );

    await service.processWebhookEvent({
      type: 'subscription.updated',
      timestamp: new Date('2026-03-09T00:00:00.000Z'),
      data: {
        id: 'sub_1',
        customerId: 'polar_c_1',
        productId: 'prod_1',
        status: 'active',
        currentPeriodStart: '2026-03-01T00:00:00.000Z',
        currentPeriodEnd: '2026-04-01T00:00:00.000Z',
        customer: {
          externalId: 'user_1',
          email: 'user@example.com',
          name: 'User One',
        },
      },
    });

    expect(billingRepositoryMock.upsertWebhookCustomer).toHaveBeenCalledTimes(
      1,
    );
    expect(billingRepositoryMock.findCustomerIdByUserId).toHaveBeenCalledWith(
      'user_1',
      client,
    );
    expect(billingRepositoryMock.upsertSubscription).toHaveBeenCalledTimes(1);
    expect(
      billingRepositoryMock.ensureUsageCounterPeriod,
    ).toHaveBeenCalledTimes(1);
  });

  it('marks event failed when processing throws', async () => {
    billingRepositoryMock.withEventProcessing.mockRejectedValue(
      new Error('boom'),
    );

    await expect(
      service.processWebhookEvent({
        type: 'subscription.updated',
        timestamp: new Date('2026-03-09T00:00:00.000Z'),
        data: { id: 'sub_1' },
      }),
    ).rejects.toThrow('boom');

    expect(billingRepositoryMock.markEventFailed.mock.calls[0]).toEqual([
      'subscription.updated:sub_1',
      'boom',
    ]);
  });

  it('does not re-process already handled duplicate events', async () => {
    const client = {} as PoolClient;

    billingRepositoryMock.withEventProcessing.mockImplementation(
      (
        _eventId: string,
        _eventType: string,
        _payload: unknown,
        callback: EventCallback,
      ) =>
        callback({
          client,
          isDuplicateProcessed: true,
          event: {
            id: 'product.updated:prod_dup',
            event_type: 'product.updated',
            status: 'processed',
            attempt_count: 1,
          },
        }),
    );

    await service.processWebhookEvent({
      type: 'product.updated',
      timestamp: new Date('2026-03-09T00:00:00.000Z'),
      data: {
        id: 'prod_dup',
      },
    });

    expect(billingRepositoryMock.upsertPlan).not.toHaveBeenCalled();
    expect(billingRepositoryMock.upsertWebhookCustomer).not.toHaveBeenCalled();
    expect(billingRepositoryMock.upsertSubscription).not.toHaveBeenCalled();
    expect(
      billingRepositoryMock.ensureUsageCounterPeriod,
    ).not.toHaveBeenCalled();
    expect(billingRepositoryMock.markEventProcessed).not.toHaveBeenCalled();
    expect(billingRepositoryMock.markEventFailed).not.toHaveBeenCalled();
  });
});
