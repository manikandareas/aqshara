import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { PolarWebhookService } from '../../infrastructure/payment-gateway/polar/polar-webhook.service';
import { BillingRepository } from './billing.repository';

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    private readonly billingRepository: BillingRepository,
    private readonly polarWebhookService: PolarWebhookService,
  ) {}

  async handlePolarWebhook(input: {
    rawBody: Buffer;
    headers: Record<string, string | string[] | undefined>;
    requestId?: string;
  }): Promise<void> {
    const event = this.polarWebhookService.validate(
      input.rawBody,
      this.normalizeHeaders(input.headers),
    );

    await this.processWebhookEvent(event);

    this.logger.log({
      eventName: event.type,
      requestId: input.requestId,
      message: 'Accepted Polar webhook event',
    });
  }

  isWebhookVerificationError(error: unknown): boolean {
    return this.polarWebhookService.isVerificationError(error);
  }

  async processWebhookEvent(event: unknown): Promise<void> {
    const eventType = this.getEventType(event);
    const eventId = this.resolveEventId(eventType, event);

    try {
      await this.billingRepository.withEventProcessing(
        eventId,
        eventType,
        event,
        async ({ client, isDuplicateProcessed }) => {
          if (isDuplicateProcessed) {
            return;
          }

          const handled = await this.handleEvent(client, eventType, event);

          await this.billingRepository.markEventProcessed(
            client,
            eventId,
            handled ? 'processed' : 'ignored',
          );
        },
      );
    } catch (error) {
      await this.billingRepository.markEventFailed(
        eventId,
        error instanceof Error
          ? error.message
          : 'Unknown webhook processing error',
      );

      throw error;
    }
  }

  private async handleEvent(
    client: PoolClient,
    eventType: string,
    event: unknown,
  ): Promise<boolean> {
    if (eventType.startsWith('product.')) {
      return this.handleProductEvent(client, event);
    }

    if (eventType.startsWith('customer.')) {
      return this.handleCustomerEvent(client, event);
    }

    if (eventType.startsWith('subscription.')) {
      return this.handleSubscriptionEvent(client, event);
    }

    this.logger.debug({
      eventType,
      message: 'Ignoring unsupported billing event',
    });
    return false;
  }

  private async handleProductEvent(
    client: PoolClient,
    event: unknown,
  ): Promise<boolean> {
    const product = this.getEventData(event);
    const productId = this.stringField(product, 'id');
    const productName = this.stringField(product, 'name');

    if (!productId || !productName) {
      return false;
    }

    const metadata = this.objectField(product, 'metadata') ?? {};
    const planCode =
      this.stringField(metadata, 'plan_code') ??
      this.stringField(metadata, 'code') ??
      productId;

    const prices = this.arrayField(product, 'prices');
    const firstPrice = prices.find((price) => {
      const isArchived = this.booleanField(price, 'isArchived');
      return isArchived === null ? true : !isArchived;
    });

    let priceAmount: number | null = null;
    let priceCurrency: string | null = null;

    if (firstPrice && this.stringField(firstPrice, 'amountType') === 'fixed') {
      priceAmount = this.numberField(firstPrice, 'priceAmount');
      priceCurrency = this.stringField(firstPrice, 'priceCurrency');
    } else if (
      firstPrice &&
      this.stringField(firstPrice, 'amountType') === 'free'
    ) {
      priceAmount = 0;
      priceCurrency = this.stringField(firstPrice, 'priceCurrency');
    }

    const recurringInterval = this.stringField(product, 'recurringInterval');
    const isArchived = this.booleanField(product, 'isArchived') ?? false;

    await this.billingRepository.upsertPlan(
      {
        id: productId,
        code: planCode,
        name: productName,
        description: this.stringField(product, 'description'),
        priceAmount,
        priceCurrency,
        interval: recurringInterval,
        isActive: !isArchived,
        metadata,
      },
      client,
    );

    return true;
  }

  private async handleCustomerEvent(
    client: PoolClient,
    event: unknown,
  ): Promise<boolean> {
    const customer = this.getEventData(event);
    const polarCustomerId = this.stringField(customer, 'id');
    const externalId = this.stringField(customer, 'externalId');

    if (!polarCustomerId || !externalId) {
      return false;
    }

    const email = this.stringField(customer, 'email');
    const name = this.stringField(customer, 'name');

    await this.billingRepository.upsertWebhookCustomer(
      {
        id: polarCustomerId,
        userId: externalId,
        polarCustomerId,
        email,
        name,
      },
      client,
    );

    return true;
  }

  private async handleSubscriptionEvent(
    client: PoolClient,
    event: unknown,
  ): Promise<boolean> {
    const subscription = this.getEventData(event);
    const subscriptionId = this.stringField(subscription, 'id');
    const customerId = this.stringField(subscription, 'customerId');
    const productId = this.stringField(subscription, 'productId');

    if (!subscriptionId || !customerId) {
      return false;
    }

    const customer = this.objectField(subscription, 'customer');
    const externalCustomerId =
      this.stringField(customer, 'externalId') ??
      `polar_customer:${customerId}`;

    await this.billingRepository.upsertWebhookCustomer(
      {
        id: customerId,
        userId: externalCustomerId,
        polarCustomerId: customerId,
        email: this.stringField(customer, 'email'),
        name: this.stringField(customer, 'name'),
        preserveExistingProfile: true,
      },
      client,
    );

    const localCustomerId = await this.billingRepository.findCustomerIdByUserId(
      externalCustomerId,
      client,
    );
    if (!localCustomerId) {
      return false;
    }

    const status = this.stringField(subscription, 'status') ?? 'unknown';
    const currentPeriodStart = this.dateField(
      subscription,
      'currentPeriodStart',
    );
    const currentPeriodEnd = this.dateField(subscription, 'currentPeriodEnd');
    const canceledAt = this.dateField(subscription, 'canceledAt');
    const cancelAtPeriodEnd =
      this.booleanField(subscription, 'cancelAtPeriodEnd') ?? false;

    await this.billingRepository.upsertSubscription(
      {
        id: subscriptionId,
        customerId: localCustomerId,
        userId: externalCustomerId,
        planId: productId,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        canceledAt,
      },
      client,
    );

    const periodKey = this.periodKey(currentPeriodStart ?? new Date());

    await this.billingRepository.ensureUsageCounterPeriod(
      localCustomerId,
      externalCustomerId,
      periodKey,
      client,
    );

    return true;
  }

  private normalizeHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        normalized[key] = value.join(',');
      } else if (typeof value === 'string') {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  private getEventType(event: unknown): string {
    if (typeof event !== 'object' || !event || !('type' in event)) {
      throw new Error('Webhook event type is missing');
    }

    const type = (event as { type?: unknown }).type;
    if (typeof type !== 'string' || type.length === 0) {
      throw new Error('Webhook event type is invalid');
    }

    return type;
  }

  private getEventData(event: unknown): Record<string, unknown> {
    if (typeof event !== 'object' || !event || !('data' in event)) {
      return {};
    }

    const data = (event as { data?: unknown }).data;
    if (!data || typeof data !== 'object') {
      return {};
    }

    return data as Record<string, unknown>;
  }

  private resolveEventId(eventType: string, event: unknown): string {
    const data = this.getEventData(event);
    const resourceId = this.stringField(data, 'id');

    if (resourceId) {
      return `${eventType}:${resourceId}`;
    }

    const timestamp = this.dateField(event, 'timestamp');
    if (timestamp) {
      return `${eventType}:${timestamp.toISOString()}`;
    }

    return `${eventType}:unknown`;
  }

  private stringField(
    value: Record<string, unknown> | null | undefined,
    key: string,
  ): string | null {
    if (!value) {
      return null;
    }

    const candidate = value[key];
    return typeof candidate === 'string' && candidate.length > 0
      ? candidate
      : null;
  }

  private numberField(
    value: Record<string, unknown> | null | undefined,
    key: string,
  ): number | null {
    if (!value) {
      return null;
    }

    const candidate = value[key];
    return typeof candidate === 'number' ? candidate : null;
  }

  private booleanField(
    value: Record<string, unknown> | null | undefined,
    key: string,
  ): boolean | null {
    if (!value) {
      return null;
    }

    const candidate = value[key];
    return typeof candidate === 'boolean' ? candidate : null;
  }

  private objectField(
    value: Record<string, unknown> | null | undefined,
    key: string,
  ): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    const candidate = value[key];
    return candidate && typeof candidate === 'object'
      ? (candidate as Record<string, unknown>)
      : null;
  }

  private arrayField(
    value: Record<string, unknown> | null | undefined,
    key: string,
  ): Record<string, unknown>[] {
    if (!value) {
      return [];
    }

    const candidate = value[key];
    if (!Array.isArray(candidate)) {
      return [];
    }

    return candidate.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    );
  }

  private dateField(value: unknown, key: string): Date | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = (value as Record<string, unknown>)[key];

    if (candidate instanceof Date) {
      return candidate;
    }

    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const date = new Date(candidate);
      if (!Number.isNaN(date.valueOf())) {
        return date;
      }
    }

    return null;
  }

  private periodKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
