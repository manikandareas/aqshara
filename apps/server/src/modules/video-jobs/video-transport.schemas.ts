import { plainToInstance } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';
import type { InternalVideoCompleteDto, InternalVideoFailDto, InternalVideoProgressDto } from './dto';
import type { VideoRenderProfile } from './video-jobs.constants';

export const VIDEO_COMMAND_TOPIC = 'video.generate.command';
export const VIDEO_EVENT_TYPES = [
  'job.accepted',
  'job.heartbeat',
  'job.progress',
  'scene.progress',
  'job.completed',
  'job.failed',
] as const;

export type VideoTransportEventType = (typeof VIDEO_EVENT_TYPES)[number];

export type VideoGenerateCommand = {
  schema_version: '2026-03-11';
  command_id: string;
  topic: typeof VIDEO_COMMAND_TOPIC;
  job_id: string;
  document_id: string;
  owner_id: string;
  request_id?: string | null;
  attempt: number;
  target_duration_sec: number;
  voice: string;
  language: 'en' | 'id';
  render_profile: VideoRenderProfile;
  ocr_object_key: string;
  output_prefix: string;
  correlation_id: string;
  trace_id?: string | null;
  occurred_at: string;
};

export type VideoAcceptedEvent = {
  schema_version: '2026-03-11';
  event_id: string;
  event_type: 'job.accepted';
  job_id: string;
  attempt: number;
  worker_id: string;
  occurred_at: string;
};

export type VideoHeartbeatEvent = {
  schema_version: '2026-03-11';
  event_id: string;
  event_type: 'job.heartbeat';
  job_id: string;
  attempt: number;
  worker_id: string;
  occurred_at: string;
};

export type VideoProgressEvent = {
  schema_version: '2026-03-11';
  event_id: string;
  event_type: 'job.progress';
  job_id: string;
  attempt: number;
  worker_id: string;
  occurred_at: string;
  payload: InternalVideoProgressDto;
};

export type VideoSceneProgressEvent = {
  schema_version: '2026-03-11';
  event_id: string;
  event_type: 'scene.progress';
  job_id: string;
  attempt: number;
  worker_id: string;
  occurred_at: string;
  payload: InternalVideoProgressDto;
};

export type VideoCompleteEvent = {
  schema_version: '2026-03-11';
  event_id: string;
  event_type: 'job.completed';
  job_id: string;
  attempt: number;
  worker_id: string;
  occurred_at: string;
  payload: InternalVideoCompleteDto;
};

export type VideoFailEvent = {
  schema_version: '2026-03-11';
  event_id: string;
  event_type: 'job.failed';
  job_id: string;
  attempt: number;
  worker_id: string;
  occurred_at: string;
  payload: InternalVideoFailDto;
};

export type VideoTransportEvent =
  | VideoAcceptedEvent
  | VideoHeartbeatEvent
  | VideoProgressEvent
  | VideoSceneProgressEvent
  | VideoCompleteEvent
  | VideoFailEvent;

class VideoBaseEnvelopeDto {
  @IsString()
  @IsNotEmpty()
  schema_version!: '2026-03-11';

  @IsString()
  @IsNotEmpty()
  event_id!: string;

  @IsIn(VIDEO_EVENT_TYPES)
  event_type!: VideoTransportEventType;

  @IsString()
  @IsNotEmpty()
  job_id!: string;

  @IsInt()
  @Min(1)
  attempt!: number;

  @IsString()
  @IsNotEmpty()
  worker_id!: string;

  @IsDateString()
  occurred_at!: string;

  @IsOptional()
  @IsObject()
  payload?: object;
}

function validateEventDto(value: unknown): VideoBaseEnvelopeDto {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid video event payload: expected object');
  }

  const dto = plainToInstance(VideoBaseEnvelopeDto, value);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const firstError = errors[0];
    const firstConstraint = firstError
      ? Object.values(firstError.constraints ?? {})[0]
      : null;
    throw new Error(
      `Invalid video event payload: ${firstConstraint ?? 'invalid payload'}`,
    );
  }

  return dto;
}

export function parseVideoTransportEvent(value: unknown): VideoTransportEvent {
  validateEventDto(value);
  return value as VideoTransportEvent;
}
