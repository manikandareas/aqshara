import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDetailDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ nullable: true })
  field?: string | null;
}

export class ApiErrorEnvelopeDto {
  @ApiProperty({ type: [ApiErrorDetailDto] })
  errors!: ApiErrorDetailDto[];
}

export class PaginationMetaDto {
  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;
}
