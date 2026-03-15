import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../src/infrastructure/database/database.service';
import { PolarWebhookService } from '../../src/infrastructure/payment-gateway/polar/polar-webhook.service';
import { BillingRepository } from '../../src/modules/billing/billing.repository';
import { BillingWebhookService } from '../../src/modules/billing/billing-webhook.service';

function parseEventId(argv: string[]): string {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--event-id' && argv[i + 1]) {
      return argv[i + 1];
    }
  }

  throw new Error('Missing --event-id argument.');
}

async function main(): Promise<void> {
  const eventId = parseEventId(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const configService = {
    getOrThrow<T>(key: string): T {
      if (key !== 'DATABASE_URL') {
        throw new Error(`Unsupported config key: ${key}`);
      }

      return databaseUrl as T;
    },
  } as unknown as ConfigService;

  const databaseService = new DatabaseService(configService);

  try {
    const eventResult = await databaseService.query<{
      id: string;
      event_type: string;
      payload: unknown;
      status: string;
    }>(
      `
      SELECT id, event_type, payload, status
      FROM billing_events
      WHERE id = $1
      LIMIT 1
      `,
      [eventId],
    );

    const event = eventResult.rows[0];
    if (!event) {
      throw new Error(`Billing event not found: ${eventId}`);
    }

    const billingRepository = new BillingRepository(databaseService);
    const billingWebhookService = new BillingWebhookService(
      billingRepository,
      {} as PolarWebhookService,
    );

    await billingWebhookService.processWebhookEvent(event.payload);

    console.log(
      `Replayed webhook event ${event.id} (type=${event.event_type}, previous_status=${event.status}).`,
    );
  } finally {
    await databaseService.onModuleDestroy();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Webhook replay failed: ${message}`);
  process.exitCode = 1;
});
