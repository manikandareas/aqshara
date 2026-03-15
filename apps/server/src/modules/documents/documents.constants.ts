export const DOCUMENT_STATUSES = [
  'uploaded',
  'processing',
  'ready',
  'error',
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const INITIAL_DOCUMENT_STATUS: DocumentStatus = 'processing';
export const INITIAL_PIPELINE_STAGE = 'queued';

export const DOCUMENT_STATUS_STREAM_EVENT = 'status';
export const DOCUMENT_STATUS_STREAM_POLL_MS = 2000;
