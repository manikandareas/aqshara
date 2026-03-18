import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  VIDEO_DEFAULT_LANGUAGE,
  VIDEO_DEFAULT_TARGET_DURATION_SEC,
  VIDEO_DEFAULT_VOICE,
  VIDEO_PIPELINE_STAGES,
  VIDEO_RENDER_PROFILES,
  VIDEO_SCENE_STATUSES,
  VIDEO_TEMPLATE_TYPES,
} from '../video-jobs.constants';

export class CreateVideoJobRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  document_id!: string;

  @ApiPropertyOptional({
    default: VIDEO_DEFAULT_TARGET_DURATION_SEC,
    minimum: 30,
    maximum: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(90)
  target_duration_sec?: number;

  @ApiPropertyOptional({ default: VIDEO_DEFAULT_VOICE })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  voice?: string;

  @ApiPropertyOptional({
    default: VIDEO_DEFAULT_LANGUAGE,
    enum: ['en', 'id'],
  })
  @IsOptional()
  @IsIn(['en', 'id'])
  language?: 'en' | 'id';
}

export class RetryVideoJobRequestDto {
  @ApiPropertyOptional({ enum: ['full'], default: 'full' })
  @IsOptional()
  @IsIn(['full'])
  mode?: 'full';
}

export class InternalVideoSceneProgressDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scene_index!: number;

  @ApiPropertyOptional({ enum: VIDEO_TEMPLATE_TYPES })
  @IsOptional()
  @IsIn(VIDEO_TEMPLATE_TYPES)
  template_type?: string;

  @ApiProperty({ enum: VIDEO_SCENE_STATUSES })
  @IsIn(VIDEO_SCENE_STATUSES)
  status!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  planned_duration_ms?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  actual_audio_duration_ms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  audio_object_key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  scene_definition_object_key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  video_object_key?: string;
}

export class InternalVideoQualityGateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  storyboard_valid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  audio_ready?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  render_valid?: boolean;
}

export class InternalVideoMetricsDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  elapsed_ms?: number;
}

export class InternalVideoProgressDto {
  @ApiProperty({ enum: VIDEO_PIPELINE_STAGES })
  @IsIn(VIDEO_PIPELINE_STAGES)
  pipeline_stage!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress_pct!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fallback_applied?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fallback_reason?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  validation_errors?: string[];

  @ApiPropertyOptional({ enum: VIDEO_RENDER_PROFILES })
  @IsOptional()
  @IsIn(VIDEO_RENDER_PROFILES)
  render_profile?: string;

  @ApiPropertyOptional({ type: InternalVideoQualityGateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InternalVideoQualityGateDto)
  quality_gate?: InternalVideoQualityGateDto;

  @ApiPropertyOptional({ type: InternalVideoSceneProgressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InternalVideoSceneProgressDto)
  scene?: InternalVideoSceneProgressDto;

  @ApiPropertyOptional({ type: InternalVideoMetricsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InternalVideoMetricsDto)
  metrics?: InternalVideoMetricsDto;
}

export class InternalVideoCompleteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  final_video_object_key!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  final_thumbnail_object_key?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  duration_sec!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  resolution!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  artifact_keys?: string[];
}

export class InternalVideoFailDto {
  @ApiProperty({ enum: VIDEO_PIPELINE_STAGES })
  @IsIn(VIDEO_PIPELINE_STAGES)
  pipeline_stage!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  error_code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  error_message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_retryable?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  failed_scene_index?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  debug_artifact_keys?: string[];
}
