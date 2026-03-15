import { Module } from '@nestjs/common';
import { PolarClientService } from './polar-client.service';
import { PolarWebhookService } from './polar-webhook.service';

@Module({
  providers: [PolarClientService, PolarWebhookService],
  exports: [PolarClientService, PolarWebhookService],
})
export class PolarModule {}
