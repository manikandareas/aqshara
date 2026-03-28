import { getAuth } from "@hono/clerk-auth";
import type { MiddlewareHandler } from "hono";
import { getRedisClient } from "@aqshara/config";
import type { ErrorEventInput } from "@aqshara/observability";
import { logErrorEvent } from "@aqshara/observability";
import { createErrorPayload, getRequestId } from "./errors.js";
import type { AppContext } from "../lib/app-context.js";

const WINDOW_MS = 60_000;

export type RateLimitStore = {
  increment: (
    key: string,
    windowMs: number,
  ) => Promise<{ count: number; resetAt: number }>;
};

type RateLimiterContextEnv = {
  Variables: {
    ctx: Pick<AppContext, "getAuthenticatedClerkUserId">;
  };
};

type RateLimiterOptions = {
  store?: RateLimitStore;
  onErrorEvent?: (event: ErrorEventInput) => void;
};

let defaultStore: RateLimitStore | undefined;
const REDIS_RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])

if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end

return { current, ttl }
`;

export function createInMemoryRateLimitStore(): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    async increment(key, windowMs) {
      const now = Date.now();
      const existing = buckets.get(key);

      if (!existing || now > existing.resetAt) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { count: 1, resetAt };
      }

      existing.count += 1;
      buckets.set(key, existing);
      return {
        count: existing.count,
        resetAt: existing.resetAt,
      };
    },
  };
}

function getDefaultStore(): RateLimitStore {
  if (defaultStore) {
    return defaultStore;
  }

  defaultStore = {
    async increment(key, windowMs) {
      const redis = await getRedisClient();
      const result = (await redis.eval(
        REDIS_RATE_LIMIT_SCRIPT,
        1,
        key,
        String(windowMs),
      )) as [number, number] | null;
      const count = Number(result?.[0] ?? 0);
      const ttlMs = Number(result?.[1] ?? windowMs);

      return {
        count,
        resetAt: Date.now() + ttlMs,
      };
    },
  };

  return defaultStore;
}

function limitForPath(path: string): number {
  if (path.includes("/exports/docx")) {
    return 40;
  }
  if (path.includes("/exports/") && path.includes("/retry")) {
    return 20;
  }
  if (path.includes("/exports/")) {
    return 30;
  }
  if (path.includes("/ai/") || path.includes("/outline/")) {
    return 40;
  }
  return 200;
}

function bucketPathFor(path: string): string {
  if (path.startsWith("/v1/documents/") && path.includes("/exports/docx")) {
    return "/v1/documents/:documentId/exports/docx";
  }
  if (path.startsWith("/v1/exports/") && path.endsWith("/retry")) {
    return "/v1/exports/:exportId/retry";
  }
  if (path.startsWith("/v1/exports/") && path.endsWith("/download")) {
    return "/v1/exports/:exportId/download";
  }
  if (path.startsWith("/v1/exports/")) {
    return "/v1/exports/:exportId";
  }
  if (path.startsWith("/v1/documents/") && path.includes("/outline/")) {
    return "/v1/documents/:documentId/outline";
  }
  if (path.startsWith("/v1/documents/") && path.includes("/ai/")) {
    return "/v1/documents/:documentId/ai";
  }
  return path;
}

function shouldFailClosed(path: string): boolean {
  return (
    path.includes("/exports/docx") ||
    (path.includes("/exports/") && path.includes("/retry")) ||
    path.includes("/ai/") ||
    path.includes("/outline/")
  );
}

function emitBackendFailure(
  onErrorEvent: (event: ErrorEventInput) => void,
  input: {
    path: string;
    requestId: string;
    identity?: string;
    limit?: number;
    error: unknown;
  },
): void {
  const message =
    input.error instanceof Error ? input.error.message : String(input.error);

  onErrorEvent({
    domain: "rate_limit",
    failureClass: "system",
    code: "rate_limit_backend_unavailable",
    path: input.path,
    requestId: input.requestId,
    message,
    ...(input.identity ? { identity: input.identity } : {}),
    ...(typeof input.limit === "number" ? { limit: input.limit } : {}),
  });
}

function emitRateLimitExceeded(
  onErrorEvent: (event: ErrorEventInput) => void,
  input: {
    path: string;
    requestId: string;
    identity: string;
    limit: number;
    count: number;
    bucket: string;
  },
): void {
  onErrorEvent({
    domain: "rate_limit",
    failureClass: "user",
    code: "rate_limited",
    path: input.path,
    requestId: input.requestId,
    identity: input.identity,
    limit: input.limit,
    count: input.count,
    bucket: input.bucket,
  });
}

function getRequesterIp(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  const forwarded = c.req.header("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

export function createIpRateLimiter(
  limit: number,
  options: RateLimiterOptions = {},
): MiddlewareHandler {
  const store = options.store ?? getDefaultStore();
  const onErrorEvent = options.onErrorEvent ?? logErrorEvent;

  return async (c, next) => {
    const ip = getRequesterIp(c);
    const key = `ip:${ip}`;
    const requestId = getRequestId(c);

    try {
      const { count } = await store.increment(key, WINDOW_MS);

      if (count <= limit) {
        await next();
        return;
      }

      emitRateLimitExceeded(onErrorEvent, {
        path: c.req.path,
        requestId,
        identity: ip,
        limit,
        count,
        bucket: key,
      });
    } catch (error) {
      emitBackendFailure(onErrorEvent, {
        path: c.req.path,
        requestId,
        identity: ip,
        limit,
        error,
      });
      await next();
      return;
    }

    return c.json(
      createErrorPayload(
        "rate_limited",
        "Too many requests; try again shortly",
        requestId,
      ),
      429,
    );
  };
}

export function createAuthenticatedRateLimiter(
  options: RateLimiterOptions = {},
): MiddlewareHandler<RateLimiterContextEnv> {
  const store = options.store ?? getDefaultStore();
  const onErrorEvent = options.onErrorEvent ?? logErrorEvent;

  return async (c, next) => {
    const path = c.req.path;
    const context = c.get("ctx");
    const clerkUserId = await context.getAuthenticatedClerkUserId(c as never);
    const clerkAuthFn = c.get("clerkAuth" as never) as unknown;
    const authUserId =
      typeof clerkAuthFn === "function"
        ? (getAuth(c as never).userId ?? null)
        : null;
    const identity =
      clerkUserId ?? authUserId ?? `ip:${getRequesterIp(c as never)}`;
    const limit = limitForPath(path);
    const bucketPath = bucketPathFor(path);
    const key = `${identity}:${bucketPath}`;
    const requestId = getRequestId(c);

    try {
      const { count } = await store.increment(key, WINDOW_MS);

      if (count <= limit) {
        await next();
        return;
      }

      emitRateLimitExceeded(onErrorEvent, {
        path,
        requestId,
        identity,
        limit,
        count,
        bucket: key,
      });
    } catch (error) {
      emitBackendFailure(onErrorEvent, {
        path,
        requestId,
        identity,
        limit,
        error,
      });

      if (shouldFailClosed(path)) {
        return c.json(
          createErrorPayload(
            "rate_limit_unavailable",
            "Rate limiting is temporarily unavailable",
            requestId,
          ),
          503,
        );
      }

      await next();
      return;
    }

    return c.json(
      createErrorPayload(
        "rate_limited",
        "Too many requests; try again shortly",
        requestId,
      ),
      429,
    );
  };
}
