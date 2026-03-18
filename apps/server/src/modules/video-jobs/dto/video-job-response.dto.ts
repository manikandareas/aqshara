import { ApiProperty } from '@nestjs/swagger';
import { VIDEO_RENDER_PROFILES } from '../video-jobs.constants';

export class VideoJobItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  document_id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  pipeline_stage!: string;

  @ApiProperty()
  progress_pct!: number;

  @ApiProperty()
  target_duration_sec!: number;

  @ApiProperty()
  voice!: string;

  @ApiProperty({ enum: ['en', 'id'] })
  language!: 'en' | 'id';

  @ApiProperty()
  retry_count!: number;

  @ApiProperty({ nullable: true })
  error_code!: string | null;

  @ApiProperty({ nullable: true })
  error_message!: string | null;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  @ApiProperty({ nullable: true })
  completed_at!: string | null;
}

export class VideoJobEnvelopeDto {
  @ApiProperty({ type: VideoJobItemDto })
  data!: VideoJobItemDto;
}

export class VideoJobStageDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  progress_pct!: number;
}

export class VideoJobQualityGateDto {
  @ApiProperty()
  storyboard_valid!: boolean;

  @ApiProperty()
  audio_ready!: boolean;

  @ApiProperty()
  render_valid!: boolean;
}

export class VideoJobSceneCountsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  done!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  running!: number;

  @ApiProperty()
  pending!: number;
}

export class VideoJobStatusErrorDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  message!: string;
}

export class VideoJobStatusPayloadDto {
  @ApiProperty()
  video_job_id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  pipeline_stage!: string;

  @ApiProperty()
  progress_pct!: number;

  @ApiProperty({ nullable: true })
  current_scene_index!: number | null;

  @ApiProperty()
  fallback_used_count!: number;

  @ApiProperty({ enum: VIDEO_RENDER_PROFILES })
  render_profile!: string;

  @ApiProperty({ type: VideoJobQualityGateDto })
  quality_gate!: VideoJobQualityGateDto;

  @ApiProperty({ type: [VideoJobStageDto] })
  stages!: VideoJobStageDto[];

  @ApiProperty({ type: VideoJobSceneCountsDto })
  scenes!: VideoJobSceneCountsDto;

  @ApiProperty({ type: VideoJobStatusErrorDto, nullable: true })
  error!: VideoJobStatusErrorDto | null;
}

export class VideoJobStatusEnvelopeDto {
  @ApiProperty({ type: VideoJobStatusPayloadDto })
  data!: VideoJobStatusPayloadDto;
}

export class VideoJobStatusStreamEventDto {
  @ApiProperty({ example: 'status' })
  type!: string;

  @ApiProperty({ type: VideoJobStatusPayloadDto })
  data!: VideoJobStatusPayloadDto;
}

export class VideoJobResultPayloadDto {
  @ApiProperty()
  video_job_id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  video_url!: string;

  @ApiProperty()
  embed_url!: string;

  @ApiProperty()
  playback_status!: string;

  @ApiProperty({ nullable: true })
  thumbnail_url!: string | null;

  @ApiProperty({ minimum: 0 })
  duration_sec!: number;

  @ApiProperty()
  resolution!: string;
}

export class VideoJobResultEnvelopeDto {
  @ApiProperty({ type: VideoJobResultPayloadDto })
  data!: VideoJobResultPayloadDto;
}
