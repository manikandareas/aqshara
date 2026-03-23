import { z } from "zod";

const envSchema = z.object({
  API_BASE_URL: z.url().default("http://localhost:3002"),
  NEXT_PUBLIC_API_BASE_URL: z.url().default("http://localhost:3002"),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().default(6379),
});

const env = envSchema.parse({
  API_BASE_URL: process.env.API_BASE_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
});

export function getApiBaseUrl() {
  return env.API_BASE_URL;
}

export function getPublicApiBaseUrl() {
  return env.NEXT_PUBLIC_API_BASE_URL;
}

export function getRedisConnection() {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
  };
}
