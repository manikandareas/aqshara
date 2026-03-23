import { z } from "zod";

const envSchema = z.object({
  API_BASE_URL: z.url().default("http://localhost:9000"),
  NEXT_PUBLIC_API_BASE_URL: z.url().default("http://localhost:9000"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().default("pk_test_placeholder"),
  CLERK_SECRET_KEY: z.string().default("sk_test_placeholder"),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().default(6379),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/aqshara"),
});

const env = envSchema.parse({
  API_BASE_URL: process.env.API_BASE_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  DATABASE_URL: process.env.DATABASE_URL,
});

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

export function getDatabaseUrl() {
  return env.DATABASE_URL;
}
