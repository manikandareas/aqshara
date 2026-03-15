import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DocumentProcessJobDto,
  TranslationRetryJobDto,
} from './dto/pipeline-job.dto';

export type DocumentProcessJobPayload = {
  document_id: string;
  actor_id: string;
  require_translate: boolean;
  request_id?: string | null;
};

export type TranslationRetryJobPayload = {
  document_id: string;
  paragraph_id: string;
  actor_id: string;
  request_id?: string | null;
};

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

export function parseDocumentProcessJobPayload(
  value: unknown,
): DocumentProcessJobPayload {
  const payload = validateJobDto(value, DocumentProcessJobDto);
  return {
    document_id: payload.document_id,
    actor_id: payload.actor_id,
    require_translate: payload.require_translate,
    request_id: payload.request_id,
  };
}

export function parseTranslationRetryJobPayload(
  value: unknown,
): TranslationRetryJobPayload {
  const payload = validateJobDto(value, TranslationRetryJobDto);
  return {
    document_id: payload.document_id,
    paragraph_id: payload.paragraph_id,
    actor_id: payload.actor_id,
    request_id: payload.request_id,
  };
}
