import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../openapi/swagger.schemas';

export class OutlineSectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  level!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  title_id!: string;

  @ApiProperty()
  para_start!: string;

  @ApiProperty({ type: () => [OutlineSectionDto] })
  children!: OutlineSectionDto[];
}

export class OutlineDataDto {
  @ApiProperty({ type: [OutlineSectionDto] })
  sections!: OutlineSectionDto[];
}

export class OutlineEnvelopeDto {
  @ApiProperty({ type: OutlineDataDto })
  data!: OutlineDataDto;
}

export class ParagraphItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  section_id!: string | null;

  @ApiProperty()
  order!: number;

  @ApiProperty()
  page_no!: number;

  @ApiProperty({ type: [Number] })
  source_span!: number[];

  @ApiProperty()
  text_raw!: string;

  @ApiProperty()
  text_raw_md!: string;

  @ApiProperty({ enum: ['en', 'id', 'unknown'] })
  source_lang!: 'en' | 'id' | 'unknown';

  @ApiProperty()
  text_en!: string;

  @ApiProperty()
  text_en_md!: string;

  @ApiProperty()
  text_id!: string;

  @ApiProperty()
  text_id_md!: string;

  @ApiProperty()
  has_translation!: boolean;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  highlighted_terms!: Record<string, unknown>[];
}

export class ParagraphListEnvelopeDto {
  @ApiProperty({ type: [ParagraphItemDto] })
  data!: ParagraphItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class ParagraphDetailEnvelopeDto {
  @ApiProperty({ type: ParagraphItemDto })
  data!: ParagraphItemDto;
}

export class SearchPayloadDto {
  @ApiProperty()
  query!: string;

  @ApiProperty()
  total!: number;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  hits!: Record<string, unknown>[];
}

export class SearchEnvelopeDto {
  @ApiProperty({ type: SearchPayloadDto })
  data!: SearchPayloadDto;
}

export class TranslationItemDto {
  @ApiProperty()
  paragraph_id!: string;

  @ApiProperty()
  text_en!: string;

  @ApiProperty()
  text_en_md!: string;

  @ApiProperty()
  text_id!: string;

  @ApiProperty()
  text_id_md!: string;

  @ApiProperty({ enum: ['pending', 'done', 'error'] })
  status!: string;

  @ApiProperty({ nullable: true })
  translated_at!: string | null;

  @ApiProperty()
  cache_hash!: string;
}

export class TranslationsListEnvelopeDto {
  @ApiProperty({ type: [TranslationItemDto] })
  data!: TranslationItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;

  @ApiProperty()
  translation_enabled!: boolean;
}

export class GlossaryOccurrenceDto {
  @ApiProperty()
  paragraph_id!: string;

  @ApiProperty()
  page_no!: number;

  @ApiProperty()
  snippet_en!: string;
}

export class GlossaryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  term_en!: string;

  @ApiProperty()
  term_id!: string;

  @ApiProperty()
  definition!: string;

  @ApiProperty()
  definition_id!: string;

  @ApiProperty()
  example!: string;

  @ApiProperty()
  example_id!: string;

  @ApiProperty()
  occurrence_count!: number;

  @ApiProperty({ type: [GlossaryOccurrenceDto] })
  occurrences!: GlossaryOccurrenceDto[];
}

export class GlossaryListEnvelopeDto {
  @ApiProperty({ type: [GlossaryItemDto] })
  data!: GlossaryItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class GlossaryDetailEnvelopeDto {
  @ApiProperty({ type: GlossaryItemDto })
  data!: GlossaryItemDto;
}

export class GlossaryLookupDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  term_en!: string;

  @ApiProperty()
  term_id!: string;

  @ApiProperty()
  definition_id!: string;

  @ApiProperty()
  example_id!: string;
}

export class GlossaryLookupEnvelopeDto {
  @ApiProperty({ type: GlossaryLookupDto })
  data!: GlossaryLookupDto;
}

export class MapNodeTreeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  label_id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: [String] })
  para_refs!: string[];

  @ApiProperty({ type: () => [MapNodeTreeDto] })
  children!: MapNodeTreeDto[];
}

export class MapTreePayloadDto {
  @ApiProperty({ type: [MapNodeTreeDto] })
  nodes!: MapNodeTreeDto[];
}

export class MapTreeEnvelopeDto {
  @ApiProperty({ type: MapTreePayloadDto })
  data!: MapTreePayloadDto;
}

export class MapNodeDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  label_id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: [String] })
  para_refs!: string[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  source_paragraphs!: Record<string, unknown>[];
}

export class MapNodeDetailEnvelopeDto {
  @ApiProperty({ type: MapNodeDetailDto })
  data!: MapNodeDetailDto;
}

export class TranslationRetryPayloadDto {
  @ApiProperty()
  paragraph_id!: string;

  @ApiProperty({ enum: ['pending'] })
  status!: 'pending';
}

export class TranslationRetryEnvelopeDto {
  @ApiProperty({ type: TranslationRetryPayloadDto })
  data!: TranslationRetryPayloadDto;
}
