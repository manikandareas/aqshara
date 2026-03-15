import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';

export type BillingPlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_amount: number | null;
  price_currency: string | null;
  interval: string | null;
  is_active: boolean;
};

export type BillingSnapshotRow = {
  user_id: string;
  customer_id: string;
  subscription_id: string | null;
  subscription_status: string | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean | null;
  canceled_at: Date | null;
  plan_id: string | null;
  plan_code: string | null;
  plan_name: string | null;
  price_amount: number | null;
  price_currency: string | null;
  interval: string | null;
  period_key: string | null;
  used_units: number | null;
  held_units: number | null;
};

export type BillingEventRow = {
  id: string;
  event_type: string;
  status: 'processing' | 'processed' | 'error' | 'ignored';
  attempt_count: number;
};

export type UpsertPlanInput = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  interval?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown>;
};

export type EnsureCustomerInput = {
  userId: string;
  polarCustomerId?: string | null;
  email?: string | null;
  name?: string | null;
};

export type UpsertSubscriptionInput = {
  id: string;
  customerId: string;
  userId: string;
  planId?: string | null;
  status: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
};

export type UpsertWebhookCustomerInput = {
  id: string;
  userId: string;
  polarCustomerId: string;
  email?: string | null;
  name?: string | null;
  preserveExistingProfile?: boolean;
};

@Injectable()
export class BillingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listActivePlans(): Promise<BillingPlanRow[]> {
    const result = await this.databaseService.query<BillingPlanRow>(
      `
      SELECT
        id,
        code,
        name,
        description,
        price_amount,
        price_currency,
        interval,
        is_active
      FROM subscription_plans
      WHERE is_active = true
      ORDER BY price_amount ASC NULLS LAST, name ASC
      `,
    );

    return result.rows;
  }

  async getPlanByCode(code: string): Promise<BillingPlanRow | null> {
    const result = await this.databaseService.query<BillingPlanRow>(
      `
      SELECT
        id,
        code,
        name,
        description,
        price_amount,
        price_currency,
        interval,
        is_active
      FROM subscription_plans
      WHERE code = $1
      LIMIT 1
      `,
      [code],
    );

    return result.rows[0] ?? null;
  }

  async getBillingSnapshotByUserId(
    userId: string,
    periodKey: string,
  ): Promise<BillingSnapshotRow | null> {
    const result = await this.databaseService.query<BillingSnapshotRow>(
      `
      SELECT
        bc.user_id,
        bc.id AS customer_id,
        s.id AS subscription_id,
        s.status AS subscription_status,
        s.current_period_start,
        s.current_period_end,
        s.cancel_at_period_end,
        s.canceled_at,
        sp.id AS plan_id,
        sp.code AS plan_code,
        sp.name AS plan_name,
        sp.price_amount,
        sp.price_currency,
        sp.interval,
        uc.period_key,
        uc.used_units,
        uc.held_units
      FROM billing_customers bc
      LEFT JOIN LATERAL (
        SELECT
          id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          canceled_at
        FROM subscriptions
        WHERE user_id = bc.user_id
        ORDER BY updated_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      LEFT JOIN usage_counters uc
        ON uc.customer_id = bc.id
       AND uc.period_key = $2
      WHERE bc.user_id = $1
      LIMIT 1
      `,
      [userId, periodKey],
    );

    return result.rows[0] ?? null;
  }

  async ensureCustomer(
    input: EnsureCustomerInput,
    client?: PoolClient,
  ): Promise<{ id: string }> {
    const existing = await this.query<{ id: string }>(
      client,
      `
      SELECT id
      FROM billing_customers
      WHERE user_id = $1
      LIMIT 1
      `,
      [input.userId],
    );

    if (existing.rows[0]) {
      await this.query(
        client,
        `
        UPDATE billing_customers
        SET
          polar_customer_id = COALESCE($2, polar_customer_id),
          email = COALESCE($3, email),
          name = COALESCE($4, name),
          updated_at = now()
        WHERE id = $1
        `,
        [
          existing.rows[0].id,
          input.polarCustomerId ?? null,
          input.email ?? null,
          input.name ?? null,
        ],
      );

      return { id: existing.rows[0].id };
    }

    const id = randomUUID();

    await this.query(
      client,
      `
      INSERT INTO billing_customers (
        id,
        user_id,
        polar_customer_id,
        email,
        name
      ) VALUES ($1, $2, $3, $4, $5)
      `,
      [
        id,
        input.userId,
        input.polarCustomerId ?? null,
        input.email ?? null,
        input.name ?? null,
      ],
    );

    return { id };
  }

  async upsertPlan(input: UpsertPlanInput, client?: PoolClient): Promise<void> {
    await this.query(
      client,
      `
      INSERT INTO subscription_plans (
        id,
        code,
        name,
        description,
        price_amount,
        price_currency,
        interval,
        is_active,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price_amount = EXCLUDED.price_amount,
        price_currency = EXCLUDED.price_currency,
        interval = EXCLUDED.interval,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      `,
      [
        input.id,
        input.code,
        input.name,
        input.description ?? null,
        input.priceAmount ?? null,
        input.priceCurrency ?? null,
        input.interval ?? null,
        input.isActive,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }

  async upsertSubscription(
    input: UpsertSubscriptionInput,
    client?: PoolClient,
  ): Promise<void> {
    await this.query(
      client,
      `
      INSERT INTO subscriptions (
        id,
        customer_id,
        user_id,
        plan_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        canceled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id)
      DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        user_id = EXCLUDED.user_id,
        plan_id = EXCLUDED.plan_id,
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = EXCLUDED.canceled_at,
        updated_at = now()
      `,
      [
        input.id,
        input.customerId,
        input.userId,
        input.planId ?? null,
        input.status,
        input.currentPeriodStart ?? null,
        input.currentPeriodEnd ?? null,
        input.cancelAtPeriodEnd ?? false,
        input.canceledAt ?? null,
      ],
    );
  }

  async upsertWebhookCustomer(
    input: UpsertWebhookCustomerInput,
    client: PoolClient,
  ): Promise<void> {
    const emailUpdate = input.preserveExistingProfile
      ? 'COALESCE(EXCLUDED.email, billing_customers.email)'
      : 'EXCLUDED.email';
    const nameUpdate = input.preserveExistingProfile
      ? 'COALESCE(EXCLUDED.name, billing_customers.name)'
      : 'EXCLUDED.name';

    await this.query(
      client,
      `
      INSERT INTO billing_customers (
        id,
        user_id,
        polar_customer_id,
        email,
        name
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        polar_customer_id = EXCLUDED.polar_customer_id,
        email = ${emailUpdate},
        name = ${nameUpdate},
        updated_at = now()
      `,
      [
        input.id,
        input.userId,
        input.polarCustomerId,
        input.email ?? null,
        input.name ?? null,
      ],
    );
  }

  async findCustomerIdByUserId(
    userId: string,
    client: PoolClient,
  ): Promise<string | null> {
    const result = await this.query<{ id: string }>(
      client,
      `
      SELECT id
      FROM billing_customers
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    return result.rows[0]?.id ?? null;
  }

  async withEventProcessing<T>(
    eventId: string,
    eventType: string,
    payload: unknown,
    callback: (args: {
      client: PoolClient;
      event: BillingEventRow;
      isDuplicateProcessed: boolean;
    }) => Promise<T>,
  ): Promise<T> {
    await this.databaseService.query(
      `
      INSERT INTO billing_events (
        id,
        event_type,
        status,
        attempt_count,
        payload
      ) VALUES ($1, $2, 'processing', 1, $3::jsonb)
      ON CONFLICT (id)
      DO NOTHING
      `,
      [eventId, eventType, JSON.stringify(payload ?? {})],
    );

    return this.databaseService.withTransaction(async (client) => {
      const eventResult = await client.query<BillingEventRow>(
        `
        SELECT
          id,
          event_type,
          status,
          attempt_count
        FROM billing_events
        WHERE id = $1
        FOR UPDATE
        `,
        [eventId],
      );

      const event = eventResult.rows[0];
      if (!event) {
        throw new Error('Billing event lock failed');
      }

      if (event.status === 'processed' || event.status === 'ignored') {
        return callback({ client, event, isDuplicateProcessed: true });
      }

      if (event.status === 'error') {
        await client.query(
          `
          UPDATE billing_events
          SET
            status = 'processing',
            attempt_count = attempt_count + 1,
            error_message = NULL,
            updated_at = now()
          WHERE id = $1
          `,
          [event.id],
        );
      }

      return callback({ client, event, isDuplicateProcessed: false });
    });
  }

  async markEventProcessed(
    client: PoolClient,
    eventId: string,
    status: 'processed' | 'ignored',
  ): Promise<void> {
    await client.query(
      `
      UPDATE billing_events
      SET
        status = $2,
        processed_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [eventId, status],
    );
  }

  async markEventFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE billing_events
      SET
        status = 'error',
        error_message = $2,
        updated_at = now()
      WHERE id = $1
      `,
      [eventId, errorMessage.slice(0, 1000)],
    );
  }

  async upsertUsageCounter(
    customerId: string,
    userId: string,
    periodKey: string,
    usedUnits: number,
    heldUnits: number,
    client?: PoolClient,
  ): Promise<void> {
    await this.query(
      client,
      `
      INSERT INTO usage_counters (
        customer_id,
        user_id,
        period_key,
        used_units,
        held_units
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (customer_id, period_key)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        used_units = EXCLUDED.used_units,
        held_units = EXCLUDED.held_units,
        updated_at = now()
      `,
      [customerId, userId, periodKey, usedUnits, heldUnits],
    );
  }

  async ensureUsageCounterPeriod(
    customerId: string,
    userId: string,
    periodKey: string,
    client: PoolClient,
  ): Promise<void> {
    await this.query(
      client,
      `
      INSERT INTO usage_counters (
        customer_id,
        user_id,
        period_key,
        used_units,
        held_units
      ) VALUES ($1, $2, $3, 0, 0)
      ON CONFLICT (customer_id, period_key)
      DO NOTHING
      `,
      [customerId, userId, periodKey],
    );
  }

  private query<T extends QueryResultRow = QueryResultRow>(
    client: PoolClient | undefined,
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    if (client) {
      return client.query<T>(sql, params);
    }

    return this.databaseService.query<T>(sql, params);
  }
}
