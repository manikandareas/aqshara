import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PolarClientService } from '../../../infrastructure/payment-gateway/polar/polar-client.service';
import { BillingRepository } from '../billing.repository';
import { BillingService } from '../billing.service';

describe('BillingService', () => {
  let service: BillingService;

  const billingRepositoryMock = {
    listActivePlans: jest.fn(),
    getPlanByCode: jest.fn(),
    getBillingSnapshotByUserId: jest.fn(),
    ensureCustomer: jest.fn(),
  };

  const polarClientServiceMock = {
    createCheckoutSession: jest.fn(),
    createCustomerPortalSession: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: BillingRepository,
          useValue: billingRepositoryMock,
        },
        {
          provide: PolarClientService,
          useValue: polarClientServiceMock,
        },
      ],
    }).compile();

    service = moduleRef.get(BillingService);
  });

  it('lists plans with response mapping', async () => {
    billingRepositoryMock.listActivePlans.mockResolvedValue([
      {
        id: 'plan_1',
        code: 'pro',
        name: 'Pro',
        description: null,
        price_amount: 9900,
        price_currency: 'USD',
        interval: 'month',
        is_active: true,
      },
    ]);

    await expect(service.listPlans()).resolves.toEqual({
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
  });

  it('rejects checkout when plan is inactive', async () => {
    billingRepositoryMock.getPlanByCode.mockResolvedValue(null);

    await expect(
      service.createCheckout('user_1', {
        plan_code: 'pro',
        success_url: 'https://app.example.com/success',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps provider checkout failures to 503', async () => {
    billingRepositoryMock.getPlanByCode.mockResolvedValue({
      id: 'plan_1',
      code: 'pro',
      name: 'Pro',
      description: 'Plan',
      price_amount: 9900,
      price_currency: 'USD',
      interval: 'month',
      is_active: true,
    });
    billingRepositoryMock.ensureCustomer.mockResolvedValue({ id: 'cust_1' });
    polarClientServiceMock.createCheckoutSession.mockRejectedValue(
      new Error('provider down'),
    );

    await expect(
      service.createCheckout('user_1', {
        plan_code: 'pro',
        success_url: 'https://app.example.com/success',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns 404 when portal requested for unknown billing customer', async () => {
    billingRepositoryMock.getBillingSnapshotByUserId.mockResolvedValue(null);

    await expect(
      service.createPortalSession('user_1', {
        return_url: 'https://app.example.com/settings',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
