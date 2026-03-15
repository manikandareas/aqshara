import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WebhookVerificationError,
  validateEvent,
} from '@polar-sh/sdk/webhooks';

@Injectable()
export class PolarWebhookService {
  constructor(private readonly configService: ConfigService) {}

  validate(body: Buffer, headers: Record<string, string>) {
    return validateEvent(
      body,
      headers,
      this.configService.getOrThrow<string>('POLAR_WEBHOOK_SECRET'),
    );
  }

  isVerificationError(error: unknown): boolean {
    return error instanceof WebhookVerificationError;
  }
}
