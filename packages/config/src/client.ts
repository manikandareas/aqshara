import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.url().default("http://localhost:9000"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().default("pk_test_placeholder"),
});

function readClientEnv() {
  return clientEnvSchema.parse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
}

export function getPublicApiBaseUrl() {
  return readClientEnv().NEXT_PUBLIC_API_BASE_URL;
}

export function getClerkPublishableKey() {
  return readClientEnv().NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}
