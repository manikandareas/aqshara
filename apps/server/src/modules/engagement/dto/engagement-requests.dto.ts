import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const FEEDBACK_TYPES = ['rating', 'issue'] as const;

export class FeedbackRequestDto {
  @ApiProperty({ enum: FEEDBACK_TYPES })
  @IsString()
  @IsNotEmpty()
  @IsIn(FEEDBACK_TYPES)
  type!: 'rating' | 'issue';

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @ValidateIf((value: FeedbackRequestDto) => value.type === 'rating')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @ValidateIf((value: FeedbackRequestDto) => value.type === 'issue')
  @IsNotEmpty()
  @IsString()
  issue_type?: string;

  @ApiPropertyOptional()
  @ValidateIf((value: FeedbackRequestDto) => value.type === 'issue')
  @IsNotEmpty()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  paragraph_id?: string;
}

export class EventPayloadDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsDateString()
  timestamp!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  document_id?: string;
}

export class EventsRequestDto {
  @ApiProperty({ type: [EventPayloadDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EventPayloadDto)
  events!: EventPayloadDto[];
}
