import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export type VideoGenerateJobPayload = {
  video_job_id: string;
  document_id: string;
  actor_id: string;
  request_id?: string | null;
  attempt: number;
};

export type VideoWorkerDispatchPayload = VideoGenerateJobPayload & {
  target_duration_sec: number;
  voice: string;
  language: 'en' | 'id';
};

class VideoGenerateJobDto {
  @IsString()
  @IsNotEmpty()
  video_job_id!: string;

  @IsString()
  @IsNotEmpty()
  document_id!: string;

  @IsString()
  @IsNotEmpty()
  actor_id!: string;

  @IsInt()
  @Min(1)
  attempt!: number;

  @IsOptional()
  @IsString()
  request_id?: string | null;
}

function validateJobDto<T extends object>(
  value: unknown,
  dtoClass: new () => T,
): T {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid job payload: expected object');
  }

  const dto = plainToInstance(dtoClass, value);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const firstError = errors[0];
    const firstConstraint = firstError
      ? Object.values(firstError.constraints ?? {})[0]
      : null;

    if (!firstConstraint) {
      throw new Error('Invalid job payload: invalid payload');
    }

    throw new Error(`Invalid job payload: ${firstConstraint}`);
  }

  return dto;
}

export function parseVideoGenerateJobPayload(
  value: unknown,
): VideoGenerateJobPayload {
  const payload = validateJobDto(value, VideoGenerateJobDto);

  return {
    video_job_id: payload.video_job_id,
    document_id: payload.document_id,
    actor_id: payload.actor_id,
    request_id: payload.request_id,
    attempt: payload.attempt,
  };
}
