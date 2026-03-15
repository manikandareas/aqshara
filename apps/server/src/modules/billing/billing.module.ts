import { Module } from '@nestjs/common';
import { PolarModule } from '../../infrastructure/payment-gateway/polar/polar.module';
import { BillingController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingService } from './billing.service';

@Module({
  imports: [PolarModule],
  controllers: [BillingController],
  providers: [BillingRepository, BillingService, BillingWebhookService],
  exports: [BillingService, BillingWebhookService, BillingRepository],
})
export class BillingModule {}
