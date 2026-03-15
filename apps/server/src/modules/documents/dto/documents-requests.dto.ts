import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DOCUMENT_STATUSES, type DocumentStatus } from '../documents.constants';

function transformBooleanFlag(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized.length === 0
    ) {
      return false;
    }
  }

  return value;
}

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES })
  @IsOptional()
  @IsIn(DOCUMENT_STATUSES)
  status?: DocumentStatus;
}

export class UploadDocumentBodyDto {
  @ApiPropertyOptional({ type: 'boolean', default: false })
  @IsOptional()
  @Transform(({ value }) => transformBooleanFlag(value))
  @IsBoolean()
  require_translate?: boolean;

  @ApiPropertyOptional({ type: 'boolean', default: false })
  @IsOptional()
  @Transform(({ value }) => transformBooleanFlag(value))
  @IsBoolean()
  require_video_generation?: boolean;
}

export class UploadDocumentRequestDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: unknown;

  @ApiPropertyOptional({ type: 'boolean', default: false })
  require_translate?: boolean;

  @ApiPropertyOptional({ type: 'boolean', default: false })
  require_video_generation?: boolean;
}
