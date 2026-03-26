import { z, createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { HealthResponseSchema } from "../openapi/schemas/common.js";
import { ErrorSchema } from "../openapi/schemas/common.js";
import type { ApiEnv } from "../hono-env.js";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["system"],
  summary: "Health check",
  responses: {
    200: {
      description: "Healthy API",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

const ReadinessResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  timestamp: z.string(),
  dependencies: z.object({
    postgres: z.boolean(),
    redis: z.boolean(),
    storage: z.boolean(),
    openai: z.boolean(),
    mistral: z.boolean(),
  }),
});

const readinessRoute = createRoute({
  method: "get",
  path: "/v1/system/readiness",
  tags: ["system"],
  summary: "Readiness check",
  responses: {
    200: {
      description: "Ready",
      content: {
        "application/json": {
          schema: ReadinessResponseSchema,
        },
      },
    },
    503: {
      description: "Not Ready",
      content: {
        "application/json": {
          schema: ReadinessResponseSchema,
        },
      },
    },
  },
});

export function registerSystemRoutes(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(readinessRoute, async (c) => {
    const isTest =
      process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
    let pgOk = false;
    try {
      if (isTest) {
        pgOk = true;
      } else {
        const { sql } = await import("drizzle-orm");
        const { getDatabase } = await import("@aqshara/database");
        const db = getDatabase();
        await db.execute(sql`SELECT 1`);
        pgOk = true;
      }
    } catch (e) {
      c.get("ctx").logger.error("Readiness check: Postgres failed", e);
    }

    let redisOk = false;
    try {
      if (isTest) {
        redisOk = true;
      } else {
        const { getRedisClient } = await import("@aqshara/config");
        const redis = getRedisClient();
        await redis.ping();
        redisOk = true;
      }
    } catch (e) {
      c.get("ctx").logger.error("Readiness check: Redis failed", e);
    }

    let storageOk = false;
    try {
      const { isR2ObjectStorageConfigured, getActiveR2Config } =
        await import("@aqshara/storage");
      if (isR2ObjectStorageConfigured()) {
        const config = getActiveR2Config();
        if (config?.bucket) {
          storageOk = true;
        }
      } else {
        const env = process.env.NODE_ENV || "development";
        if (
          env === "production" ||
          env === "staging" ||
          process.env.STORAGE_DRIVER === "r2"
        ) {
          storageOk = false;
        } else {
          // Fallback for local testing if not configured
          storageOk = true;
        }
      }
    } catch (e) {
      c.get("ctx").logger.error("Readiness check: Storage failed", e);
    }

    const openaiOk = !!process.env.OPENAI_API_KEY?.trim();
    const mistralOk = !!process.env.MISTRAL_API_KEY?.trim();

    // Core readiness only requires PG, Redis, Storage, and OpenAI. Mistral is optional fallback.
    const ready = pgOk && redisOk && storageOk && openaiOk;

    const payload = {
      ok: ready,
      service: "api",
      timestamp: new Date().toISOString(),
      dependencies: {
        postgres: pgOk,
        redis: redisOk,
        storage: storageOk,
        openai: openaiOk,
        mistral: mistralOk,
      },
    };

    if (!ready) {
      return c.json(payload, 503);
    }
    return c.json(payload, 200);
  });

  app.openapi(healthRoute, (c) => {
    return c.json({
      ok: true,
      service: "api",
      timestamp: new Date().toISOString(),
    });
  });
}
