import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PolarClientService } from '../../infrastructure/payment-gateway/polar/polar-client.service';
import {
  BillingCheckoutEnvelopeDto,
  BillingCheckoutRequestDto,
  BillingPlansEnvelopeDto,
  BillingPortalEnvelopeDto,
  BillingPortalRequestDto,
  BillingSnapshotEnvelopeDto,
} from './dto';
import { BillingRepository } from './billing.repository';

@Injectable()
export class BillingService {
  constructor(
    private readonly billingRepository: BillingRepository,
    private readonly polarClientService: PolarClientService,
  ) {}

  async listPlans(): Promise<BillingPlansEnvelopeDto> {
    const rows = await this.billingRepository.listActivePlans();

    return {
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description ?? '',
        price_amount: row.price_amount,
        price_currency: row.price_currency ?? '',
        interval: row.interval ?? '',
      })),
    };
  }

  async getMyBilling(userId: string): Promise<BillingSnapshotEnvelopeDto> {
    const periodKey = this.currentPeriodKey();
    const snapshot = await this.billingRepository.getBillingSnapshotByUserId(
      userId,
      periodKey,
    );

    if (!snapshot) {
      return {
        data: {
          customer_id: '',
          subscription: null,
          usage: {
            period_key: periodKey,
            used_units: 0,
            held_units: 0,
          },
        },
      };
    }

    return {
      data: {
        customer_id: snapshot.customer_id,
        subscription: snapshot.subscription_id
          ? {
              id: snapshot.subscription_id,
              status: snapshot.subscription_status ?? 'unknown',
              current_period_start:
                snapshot.current_period_start?.toISOString() ?? null,
              current_period_end:
                snapshot.current_period_end?.toISOString() ?? null,
              cancel_at_period_end: snapshot.cancel_at_period_end ?? false,
              canceled_at: snapshot.canceled_at?.toISOString() ?? null,
              plan: snapshot.plan_id
                ? {
                    id: snapshot.plan_id,
                    code: snapshot.plan_code ?? '',
                    name: snapshot.plan_name ?? '',
                    price_amount: snapshot.price_amount,
                    price_currency: snapshot.price_currency ?? '',
                    interval: snapshot.interval ?? '',
                  }
                : null,
            }
          : null,
        usage: {
          period_key: snapshot.period_key ?? periodKey,
          used_units: snapshot.used_units ?? 0,
          held_units: snapshot.held_units ?? 0,
        },
      },
    };
  }

  async createCheckout(
    userId: string,
    payload: BillingCheckoutRequestDto,
  ): Promise<BillingCheckoutEnvelopeDto> {
    const plan = await this.billingRepository.getPlanByCode(payload.plan_code);
    if (!plan || !plan.is_active) {
      throw new BadRequestException('Unknown or inactive plan');
    }

    await this.billingRepository.ensureCustomer({ userId });

    try {
      const checkout = await this.polarClientService.createCheckoutSession({
        productId: plan.id,
        externalCustomerId: userId,
        successUrl: payload.success_url,
        returnUrl: payload.return_url,
      });

      return {
        data: {
          checkout_id: checkout.id,
          checkout_url: checkout.url,
          expires_at: checkout.expiresAt.toISOString(),
        },
      };
    } catch {
      throw new ServiceUnavailableException(
        'Billing provider unavailable for checkout',
      );
    }
  }

  async createPortalSession(
    userId: string,
    payload: BillingPortalRequestDto,
  ): Promise<BillingPortalEnvelopeDto> {
    const customer = await this.billingRepository.getBillingSnapshotByUserId(
      userId,
      this.currentPeriodKey(),
    );

    if (!customer?.customer_id) {
      throw new NotFoundException('Billing customer not found');
    }

    try {
      const session = await this.polarClientService.createCustomerPortalSession(
        {
          externalCustomerId: userId,
          returnUrl: payload.return_url,
        },
      );

      return {
        data: {
          portal_url: session.customerPortalUrl,
          expires_at: session.expiresAt.toISOString(),
        },
      };
    } catch {
      throw new ServiceUnavailableException('Billing provider unavailable');
    }
  }

  private currentPeriodKey(now = new Date()): string {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
