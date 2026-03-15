import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  REDIS_URL: Joi.string().uri().required(),

  DOCUMENT_PROCESS_QUEUE_NAME: Joi.string().default('document.process'),
  DOCUMENT_PROCESS_RETRY_QUEUE_NAME: Joi.string().default(
    'document.process.retry',
  ),
  DOCUMENT_PROCESS_DLQ_QUEUE_NAME: Joi.string().default('document.process.dlq'),
  TRANSLATION_RETRY_QUEUE_NAME: Joi.string().default('translation.retry'),
  TRANSLATION_RETRY_RETRY_QUEUE_NAME: Joi.string().default(
    'translation.retry.retry',
  ),
  TRANSLATION_RETRY_DLQ_QUEUE_NAME: Joi.string().default(
    'translation.retry.dlq',
  ),
  VIDEO_GENERATE_QUEUE_NAME: Joi.string().default('video.generate'),
  VIDEO_GENERATE_RETRY_QUEUE_NAME: Joi.string().default('video.generate.retry'),
  VIDEO_GENERATE_DLQ_QUEUE_NAME: Joi.string().default('video.generate.dlq'),
  VIDEO_WORKER_COMMAND: Joi.string().default('uv'),
  VIDEO_WORKER_PROJECT_DIR: Joi.string().default('../aqshara-video-worker'),
  VIDEO_WORKER_ENTRY_MODULE: Joi.string().default(
    'aqshara_video_worker.run_job',
  ),
  VIDEO_RENDER_BACKEND: Joi.string().valid('mock', 'daytona').default('mock'),
  VIDEO_RENDER_PROFILE: Joi.string().valid('480p', '720p').default('720p'),
  VIDEO_RENDER_TIMEOUT_SEC: Joi.number().integer().positive().default(180),
  VIDEO_WORKER_CALLBACK_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://127.0.0.1:8000/api/v1'),
  VIDEO_WORKER_TIMEOUT_MS: Joi.number().integer().positive().default(300000),
  BUNNY_STREAM_API_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://video.bunnycdn.com'),
  BUNNY_STREAM_API_KEY: Joi.string().allow('').optional(),
  BUNNY_STREAM_LIBRARY_ID: Joi.string().allow('').optional(),
  BUNNY_STREAM_TIMEOUT_MS: Joi.number().integer().positive().default(30000),
  VIDEO_COMMAND_STREAM_NAME: Joi.string().default('video.job.commands'),
  VIDEO_EVENT_STREAM_NAME: Joi.string().default('video.job.events'),
  VIDEO_EVENT_CONSUMER_GROUP: Joi.string().default('video-api'),
  VIDEO_EVENT_CONSUMER_NAME: Joi.string().default('video-api-1'),
  VIDEO_STREAM_BATCH_SIZE: Joi.number().integer().positive().default(20),
  VIDEO_STREAM_BLOCK_MS: Joi.number().integer().min(100).default(5000),
  VIDEO_OUTBOX_POLL_MS: Joi.number().integer().positive().default(1000),
  VIDEO_WATCHDOG_POLL_MS: Joi.number().integer().positive().default(15000),
  VIDEO_WORKER_LEASE_TTL_MS: Joi.number().integer().positive().default(45000),
  VIDEO_AUTO_RETRY_MAX_ATTEMPTS: Joi.number().integer().min(1).default(3),
  VIDEO_MERGE_TIMEOUT_SEC: Joi.number().integer().positive().default(120),
  VIDEO_AUDIO_SYNC_MAX_DRIFT_PCT: Joi.number().positive().default(15),
  FFMPEG_BINARY: Joi.string().default('ffmpeg'),
  FFPROBE_BINARY: Joi.string().default('ffprobe'),
  DAYTONA_API_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .optional(),
  DAYTONA_API_KEY: Joi.string().allow('').optional(),
  DAYTONA_TARGET: Joi.string().allow('').optional(),
  DAYTONA_PYTHON_VERSION: Joi.string().default('3.12'),
  DAYTONA_RENDER_IMAGE: Joi.string().allow('').optional(),
  DAYTONA_CREATE_TIMEOUT_SEC: Joi.number().integer().positive().default(300),
  DAYTONA_RENDER_CPU: Joi.number().integer().positive().default(2),
  DAYTONA_RENDER_MEMORY_GB: Joi.number().integer().positive().default(4),
  DAYTONA_RENDER_DISK_GB: Joi.number().integer().positive().default(8),
  QUEUE_DISABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  MISTRAL_API_KEY: Joi.string().required(),
  MISTRAL_OCR_MODEL: Joi.string().default('mistral-ocr-latest'),
  MISTRAL_TIMEOUT_MS: Joi.number().integer().positive().default(60000),
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_TRANSLATION_MODEL: Joi.string().default('gpt-4.1'),
  OPENAI_TRANSLATION_TIMEOUT_MS: Joi.number()
    .integer()
    .positive()
    .default(60000),
  OPENAI_GLOSSARY_MODEL: Joi.string().default('gpt-4.1'),
  OPENAI_GLOSSARY_TIMEOUT_MS: Joi.number().integer().positive().default(90000),

  R2_ENDPOINT: Joi.string().uri().required(),
  R2_PUBLIC_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .optional(),
  R2_REGION: Joi.string().default('auto'),
  R2_ACCESS_KEY_ID: Joi.string().required(),
  R2_SECRET_ACCESS_KEY: Joi.string().required(),
  R2_BUCKET: Joi.string().required(),
  DOCUMENT_UPLOAD_MAX_BYTES: Joi.number()
    .integer()
    .positive()
    .default(52428800),
  READINESS_CHECK_STORAGE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  CLERK_SECRET_KEY: Joi.string().required(),
  CLERK_PUBLISHABLE_KEY: Joi.string().required(),
  CLERK_JWT_KEY: Joi.string().allow('').optional(),
  CLERK_AUTHORIZED_PARTIES: Joi.string().optional(),
  POLAR_ACCESS_TOKEN: Joi.string().required(),
  POLAR_WEBHOOK_SECRET: Joi.string().required(),
  VIDEO_INTERNAL_SERVICE_TOKEN: Joi.string().default(
    'local-video-internal-token',
  ),
});
