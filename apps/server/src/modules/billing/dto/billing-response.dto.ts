import { ApiProperty } from '@nestjs/swagger';

export class BillingPlanItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ nullable: true })
  price_amount!: number | null;

  @ApiProperty()
  price_currency!: string;

  @ApiProperty()
  interval!: string;
}

export class BillingPlansEnvelopeDto {
  @ApiProperty({ type: [BillingPlanItemDto] })
  data!: BillingPlanItemDto[];
}

export class BillingPlanSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  price_amount!: number | null;

  @ApiProperty()
  price_currency!: string;

  @ApiProperty()
  interval!: string;
}

export class BillingSubscriptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  current_period_start!: string | null;

  @ApiProperty({ nullable: true })
  current_period_end!: string | null;

  @ApiProperty()
  cancel_at_period_end!: boolean;

  @ApiProperty({ nullable: true })
  canceled_at!: string | null;

  @ApiProperty({ nullable: true, type: BillingPlanSummaryDto })
  plan!: BillingPlanSummaryDto | null;
}

export class BillingUsageDto {
  @ApiProperty()
  period_key!: string;

  @ApiProperty()
  used_units!: number;

  @ApiProperty()
  held_units!: number;
}

export class BillingSnapshotDto {
  @ApiProperty()
  customer_id!: string;

  @ApiProperty({ nullable: true, type: BillingSubscriptionDto })
  subscription!: BillingSubscriptionDto | null;

  @ApiProperty({ type: BillingUsageDto })
  usage!: BillingUsageDto;
}

export class BillingSnapshotEnvelopeDto {
  @ApiProperty({ type: BillingSnapshotDto })
  data!: BillingSnapshotDto;
}

export class BillingCheckoutResponseDto {
  @ApiProperty()
  checkout_id!: string;

  @ApiProperty()
  checkout_url!: string;

  @ApiProperty()
  expires_at!: string;
}

export class BillingCheckoutEnvelopeDto {
  @ApiProperty({ type: BillingCheckoutResponseDto })
  data!: BillingCheckoutResponseDto;
}

export class BillingPortalResponseDto {
  @ApiProperty()
  portal_url!: string;

  @ApiProperty()
  expires_at!: string;
}

export class BillingPortalEnvelopeDto {
  @ApiProperty({ type: BillingPortalResponseDto })
  data!: BillingPortalResponseDto;
}
