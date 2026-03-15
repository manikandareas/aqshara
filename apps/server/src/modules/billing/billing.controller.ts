import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorEnvelopeDto } from '../../openapi/swagger.schemas';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import {
  BillingCheckoutEnvelopeDto,
  BillingCheckoutRequestDto,
  BillingPlansEnvelopeDto,
  BillingPortalEnvelopeDto,
  BillingPortalRequestDto,
  BillingSnapshotEnvelopeDto,
} from './dto';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingService } from './billing.service';

@ApiTags('Billing')
@ApiBearerAuth('bearer')
@Controller()
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingWebhookService: BillingWebhookService,
  ) {}

  @Get('billing/plans')
  @ApiOperation({ summary: 'List active billing plans' })
  @ApiOkResponse({ type: BillingPlansEnvelopeDto })
  listPlans() {
    return this.billingService.listPlans();
  }

  @Get('billing/me')
  @ApiOperation({ summary: 'Get billing snapshot for current user' })
  @ApiOkResponse({ type: BillingSnapshotEnvelopeDto })
  getMyBilling(@CurrentUserId() userId: string) {
    return this.billingService.getMyBilling(userId);
  }

  @Post('billing/checkout')
  @ApiOperation({ summary: 'Create checkout session' })
  @ApiBody({ type: BillingCheckoutRequestDto })
  @ApiOkResponse({ type: BillingCheckoutEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorEnvelopeDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorEnvelopeDto })
  createCheckout(
    @CurrentUserId() userId: string,
    @Body() body: BillingCheckoutRequestDto,
  ) {
    return this.billingService.createCheckout(userId, body);
  }

  @Post('billing/portal')
  @ApiOperation({ summary: 'Create customer portal session' })
  @ApiBody({ type: BillingPortalRequestDto })
  @ApiOkResponse({ type: BillingPortalEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorEnvelopeDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorEnvelopeDto })
  createPortal(
    @CurrentUserId() userId: string,
    @Body() body: BillingPortalRequestDto,
  ) {
    return this.billingService.createPortalSession(userId, body ?? {});
  }

  @Public()
  @ApiTags('Webhooks')
  @Post('webhooks/polar')
  @HttpCode(202)
  @ApiOperation({ summary: 'Handle Polar billing webhook' })
  @ApiHeader({
    name: 'webhook-signature',
    required: false,
    description: 'Provider webhook signature header',
  })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  @ApiAcceptedResponse({ description: 'Webhook accepted' })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  async handlePolarWebhook(
    @Req() request: AuthenticatedRequest,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    try {
      await this.billingWebhookService.handlePolarWebhook({
        rawBody: request.rawBody ?? Buffer.alloc(0),
        headers,
        requestId: typeof request.id === 'string' ? request.id : undefined,
      });
    } catch (error) {
      if (this.billingWebhookService.isWebhookVerificationError(error)) {
        throw new ForbiddenException('Invalid webhook signature');
      }

      throw error;
    }
  }
}
