import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class BillingCheckoutRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  plan_code!: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  success_url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  return_url?: string;
}

export class BillingPortalRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  return_url?: string;
}
