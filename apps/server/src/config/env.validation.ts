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
  VIDEO_REMOTION_COMPOSITION_ID: Joi.string().default('AqsharaVideo'),
  VIDEO_REMOTION_ENTRY: Joi.string().allow('').optional(),
  VIDEO_CREATIVE_MODEL: Joi.string().default('gpt-4.1'),
  VIDEO_CREATIVE_TIMEOUT_MS: Joi.number().integer().positive().default(90000),
  VIDEO_TTS_MODEL: Joi.string().default('gpt-4o-mini-tts'),
  VIDEO_TTS_RESPONSE_FORMAT: Joi.string().valid('mp3', 'wav').default('mp3'),
  VIDEO_TTS_TIMEOUT_MS: Joi.number().integer().positive().default(60000),
  VIDEO_RENDER_PROFILE: Joi.string().valid('480p', '720p').default('720p'),
  VIDEO_RENDER_TIMEOUT_SEC: Joi.number().integer().positive().default(180),
  BUNNY_STREAM_API_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://video.bunnycdn.com'),
  BUNNY_STREAM_API_KEY: Joi.string().allow('').optional(),
  BUNNY_STREAM_LIBRARY_ID: Joi.string().allow('').optional(),
  BUNNY_STREAM_TIMEOUT_MS: Joi.number().integer().positive().default(30000),
  VIDEO_WATCHDOG_POLL_MS: Joi.number().integer().positive().default(15000),
  VIDEO_WORKER_LEASE_TTL_MS: Joi.number().integer().positive().default(45000),
  VIDEO_AUTO_RETRY_MAX_ATTEMPTS: Joi.number().integer().min(1).default(3),
  FFMPEG_BINARY: Joi.string().default('ffmpeg'),
  FFPROBE_BINARY: Joi.string().default('ffprobe'),
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
});
