import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const READER_LANGS = ['en', 'id'] as const;
const TRANSLATION_STATUSES = ['pending', 'done', 'error'] as const;
const GLOSSARY_SORTS = ['frequency', 'alphabetical'] as const;

export class ReaderParagraphsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  section_id?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ReaderSearchQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  q!: string;

  @ApiPropertyOptional({ default: 'en', enum: READER_LANGS })
  @IsOptional()
  @IsIn(READER_LANGS)
  lang?: 'en' | 'id';
}

export class ReaderTranslationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ enum: TRANSLATION_STATUSES })
  @IsOptional()
  @IsIn(TRANSLATION_STATUSES)
  status?: 'pending' | 'done' | 'error';
}

export class ReaderGlossaryQueryDto {
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

  @ApiPropertyOptional({ default: 'frequency', enum: GLOSSARY_SORTS })
  @IsOptional()
  @IsIn(GLOSSARY_SORTS)
  sort?: 'frequency' | 'alphabetical';
}

export class ReaderGlossaryLookupQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  term!: string;

  @ApiPropertyOptional({ default: 'en', enum: READER_LANGS })
  @IsOptional()
  @IsIn(READER_LANGS)
  lang?: 'en' | 'id';
}
