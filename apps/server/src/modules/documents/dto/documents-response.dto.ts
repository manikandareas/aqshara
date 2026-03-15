import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../openapi/swagger.schemas';

export class DocumentItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  filename!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  pipeline_stage!: string;

  @ApiProperty()
  require_translate!: boolean;

  @ApiProperty()
  require_video_generation!: boolean;

  @ApiProperty({ enum: ['en', 'id', 'unknown'] })
  source_lang!: 'en' | 'id' | 'unknown';

  @ApiProperty({ nullable: true })
  page_count!: number | null;

  @ApiProperty()
  created_at!: string;
}

export class DocumentDetailDto extends DocumentItemDto {
  @ApiProperty({ nullable: true })
  title!: string | null;

  @ApiProperty({ nullable: true })
  abstract!: string | null;

  @ApiProperty({ nullable: true })
  pdf_type!: string | null;

  @ApiProperty({ nullable: true })
  ocr_quality!: number | null;

  @ApiProperty({ nullable: true })
  processed_at!: string | null;

  @ApiProperty({
    nullable: true,
    type: () => DocumentVideoSummaryDto,
  })
  video!: DocumentVideoSummaryDto | null;
}

export class DocumentVideoSummaryDto {
  @ApiProperty()
  job_id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  pipeline_stage!: string;

  @ApiProperty()
  progress_pct!: number;

  @ApiProperty({ nullable: true })
  video_url!: string | null;

  @ApiProperty()
  playback_status!: string;

  @ApiProperty({ nullable: true })
  thumbnail_url!: string | null;

  @ApiProperty({ nullable: true })
  completed_at!: string | null;
}

export class DocumentListEnvelopeDto {
  @ApiProperty({ type: [DocumentItemDto] })
  data!: DocumentItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class DocumentItemEnvelopeDto {
  @ApiProperty({ type: DocumentItemDto })
  data!: DocumentItemDto;
}

export class DocumentDetailEnvelopeDto {
  @ApiProperty({ type: DocumentDetailDto })
  data!: DocumentDetailDto;
}

export class DocumentStageDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  progress_pct!: number | null;

  @ApiProperty({ nullable: true })
  started_at!: string | null;

  @ApiProperty({ nullable: true })
  finished_at!: string | null;
}

export class DocumentStatusPayloadDto {
  @ApiProperty()
  document_id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  pipeline_stage!: string;

  @ApiProperty({ type: [DocumentStageDto] })
  stages!: DocumentStageDto[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  warnings!: Record<string, unknown>[];
}

export class DocumentStatusEnvelopeDto {
  @ApiProperty({ type: DocumentStatusPayloadDto })
  data!: DocumentStatusPayloadDto;
}

export class DocumentStatusStreamEventDto {
  @ApiProperty({ example: 'status' })
  type!: string;

  @ApiProperty({ type: DocumentStatusPayloadDto })
  data!: DocumentStatusPayloadDto;
}
