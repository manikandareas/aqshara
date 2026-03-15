export const VIDEO_JOB_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
  'canceled',
] as const;

export const VIDEO_PIPELINE_STAGES = [
  'queued',
  'preprocessing',
  'summarizing',
  'storyboarding',
  'storyboard_validating',
  'tts_generating',
  'code_validating',
  'rendering',
  'merging',
  'uploading',
  'stream_processing',
  'completed',
  'failed',
] as const;

export const VIDEO_SCENE_STATUSES = [
  'pending',
  'processing',
  'done',
  'error',
] as const;

export const VIDEO_TEMPLATE_TYPES = [
  'title',
  'bullet',
  'pipeline',
  'chart',
  'conclusion',
] as const;

export const VIDEO_RENDER_PROFILES = ['480p', '720p'] as const;

export const VIDEO_STATUS_STREAM_EVENT = 'status';
export const VIDEO_STATUS_STREAM_POLL_MS = 2000;
export const VIDEO_DEFAULT_TARGET_DURATION_SEC = 60;
export const VIDEO_DEFAULT_VOICE = 'alloy';
export const VIDEO_DEFAULT_LANGUAGE = 'en';
export const VIDEO_DEFAULT_RENDER_PROFILE = '720p';
export const VIDEO_INTERNAL_TOKEN_HEADER = 'x-internal-service-token';
export const VIDEO_INTERNAL_IDEMPOTENCY_HEADER = 'x-idempotency-key';

export type VideoJobStatus = (typeof VIDEO_JOB_STATUSES)[number];
export type VideoPipelineStage = (typeof VIDEO_PIPELINE_STAGES)[number];
export type VideoSceneStatus = (typeof VIDEO_SCENE_STATUSES)[number];
export type VideoTemplateType = (typeof VIDEO_TEMPLATE_TYPES)[number];
export type VideoRenderProfile = (typeof VIDEO_RENDER_PROFILES)[number];

export const VIDEO_ACTIVE_JOB_STATUSES: ReadonlySet<VideoJobStatus> = new Set([
  'queued',
  'processing',
]);

export const VIDEO_TERMINAL_JOB_STATUSES: ReadonlySet<VideoJobStatus> = new Set(
  ['completed', 'failed', 'canceled'],
);

export const VIDEO_PROGRESS_STAGE_ORDER: VideoPipelineStage[] = [
  'queued',
  'preprocessing',
  'summarizing',
  'storyboarding',
  'storyboard_validating',
  'tts_generating',
  'code_validating',
  'rendering',
  'merging',
  'uploading',
  'stream_processing',
  'completed',
  'failed',
];

export const VIDEO_PIPELINE_STAGE_INDEX = Object.fromEntries(
  VIDEO_PROGRESS_STAGE_ORDER.map((stage, index) => [stage, index]),
) as Record<VideoPipelineStage, number>;

export type VideoQualityGate = {
  storyboard_valid: boolean;
  code_valid: boolean;
  render_valid: boolean;
  audio_sync_valid: boolean;
};

export const VIDEO_DEFAULT_QUALITY_GATE: VideoQualityGate = {
  storyboard_valid: false,
  code_valid: false,
  render_valid: false,
  audio_sync_valid: false,
};
