import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Polar } from '@polar-sh/sdk';

@Injectable()
export class PolarClientService {
  private readonly client: Polar;

  constructor(private readonly configService: ConfigService) {
    this.client = new Polar({
      accessToken: this.configService.getOrThrow<string>('POLAR_ACCESS_TOKEN'),
    });
  }

  async createCheckoutSession(input: {
    productId: string;
    externalCustomerId: string;
    successUrl: string;
    returnUrl?: string;
  }) {
    return this.client.checkouts.create({
      products: [input.productId],
      externalCustomerId: input.externalCustomerId,
      successUrl: input.successUrl,
      returnUrl: input.returnUrl ?? null,
    });
  }

  async createCustomerPortalSession(input: {
    externalCustomerId: string;
    returnUrl?: string;
  }) {
    return this.client.customerSessions.create({
      externalCustomerId: input.externalCustomerId,
      returnUrl: input.returnUrl ?? null,
    });
  }
}
