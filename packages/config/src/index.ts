import { z } from "zod";
import IORedis, { type Redis as RedisClient } from "ioredis";

const envSchema = z.object({
  API_BASE_URL: z.url().default("http://localhost:9000"),
  NEXT_PUBLIC_API_BASE_URL: z.url().default("http://localhost:9000"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().default("pk_test_placeholder"),
  CLERK_SECRET_KEY: z.string().default("sk_test_placeholder"),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().default(6379),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/aqshara"),
  /** Cloudflare R2 (S3-compatible). When unset, source uploads use local dev storage. */
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  /** Mistral OCR (`POST /v1/ocr`). Optional in dev/tests. */
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_API_BASE_URL: z.url().default("https://api.mistral.ai"),
});

const env = envSchema.parse({
  API_BASE_URL: process.env.API_BASE_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET: process.env.R2_BUCKET,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  MISTRAL_API_BASE_URL: process.env.MISTRAL_API_BASE_URL,
});

let redisClient: RedisClient | undefined;

export function getApiBaseUrl() {
  return env.API_BASE_URL;
}

export function getPublicApiBaseUrl() {
  return env.NEXT_PUBLIC_API_BASE_URL;
}

export function getClerkPublishableKey() {
  return env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

export function getClerkSecretKey() {
  return env.CLERK_SECRET_KEY;
}

export function getRedisConnection() {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
  };
}

export function getRedisClient(): RedisClient {
  if (!redisClient) {
    const connection = getRedisConnection();
    const RedisCtor = IORedis as unknown as {
      new (options: {
        host: string;
        port: number;
        lazyConnect: boolean;
        connectTimeout: number;
        commandTimeout: number;
        enableOfflineQueue: boolean;
        maxRetriesPerRequest: number;
        retryStrategy: () => null;
      }): RedisClient;
    };

    redisClient = new RedisCtor({
      host: connection.host,
      port: connection.port,
      lazyConnect: true,
      connectTimeout: 500,
      commandTimeout: 500,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
  }

  return redisClient!;
}

export function getDatabaseUrl() {
  return env.DATABASE_URL;
}

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export function getR2Config(): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } =
    env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET
  ) {
    return null;
  }
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
  };
}

export function getR2Endpoint(accountId: string) {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function getMistralApiKey() {
  return env.MISTRAL_API_KEY ?? null;
}

export function getMistralApiBaseUrl() {
  return env.MISTRAL_API_BASE_URL;
}
