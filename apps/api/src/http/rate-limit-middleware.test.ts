import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";
import type { ErrorEventInput } from "@aqshara/observability";
import {
  createAuthenticatedRateLimiter,
  createIpRateLimiter,
  type RateLimitStore,
} from "./rate-limit-middleware.js";

type TestEnv = {
  Variables: {
    ctx: {
      getAuthenticatedClerkUserId: () => Promise<string | null>;
    };
  };
};

function createStore(
  impl: RateLimitStore["increment"],
): RateLimitStore {
  return {
    increment: impl,
  };
}

function createApiApp(input: {
  store: RateLimitStore;
  onErrorEvent?: (event: ErrorEventInput) => void;
}) {
  const app = new Hono<TestEnv>();

  app.use("*", async (c, next) => {
    c.set(
      "ctx",
      {
        getAuthenticatedClerkUserId: async () =>
          c.req.header("x-test-user-id") ?? null,
      } as never,
    );
    await next();
  });

  app.use(
    "/v1/*",
    createAuthenticatedRateLimiter({
      store: input.store,
      onErrorEvent: input.onErrorEvent,
    }),
  );

  app.post("/v1/documents/:documentId/exports/docx", (c) =>
    c.json({ ok: true }, 200),
  );
  app.get("/v1/exports/:exportId/retry", (c) => c.json({ ok: true }, 200));
  app.get("/v1/exports/:exportId", (c) => c.json({ ok: true }, 200));
  app.get("/v1/me", (c) => c.json({ ok: true }, 200));

  return app;
}

function createWebhookApp(input: {
  store: RateLimitStore;
  onErrorEvent?: (event: ErrorEventInput) => void;
}) {
  const app = new Hono();
  app.use(
    "/webhooks/*",
    createIpRateLimiter(1, {
      store: input.store,
      onErrorEvent: input.onErrorEvent,
    }),
  );
  app.post("/webhooks/clerk", (c) => c.json({ ok: true }, 200));
  return app;
}

describe("rate-limit middleware", () => {
  it("uses route-family buckets and emits an event when authenticated limits are exceeded", async () => {
    const counts = new Map<string, number>();
    const events: Array<{ code: string; failureClass: string; path?: string }> =
      [];
    const store = createStore(async (key) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return {
        count,
        resetAt: Date.now() + 60_000,
      };
    });

    const app = createApiApp({
      store,
      onErrorEvent(event) {
        events.push({
          code: event.code,
          failureClass: event.failureClass,
          path: typeof event.path === "string" ? event.path : undefined,
        });
      },
    });

    let lastResponse = await app.request("http://localhost/v1/exports/exp-0/retry", {
      headers: {
        "x-test-user-id": "user-rate-limit-1",
      },
    });

    assert.equal(lastResponse.status, 200);

    for (let i = 0; i < 20; i += 1) {
      lastResponse = await app.request(`http://localhost/v1/exports/exp-${i + 1}/retry`, {
        headers: {
          "x-test-user-id": "user-rate-limit-1",
        },
      });
    }

    assert.equal(lastResponse.status, 429);
    assert.equal((await lastResponse.json()).code, "rate_limited");
    assert.deepEqual(events.at(-1), {
      code: "rate_limited",
      failureClass: "user",
      path: "/v1/exports/exp-20/retry",
    });
  });

  it("fails closed on sensitive authenticated routes when the limiter backend is unavailable", async () => {
    const events: Array<{ code: string; failureClass: string }> = [];
    const store = createStore(async () => {
      throw new Error("redis unavailable");
    });

    const app = createApiApp({
      store,
      onErrorEvent(event) {
        events.push({
          code: event.code,
          failureClass: event.failureClass,
        });
      },
    });

    const response = await app.request("http://localhost/v1/exports/exp-1/retry", {
      headers: {
        "x-test-user-id": "user-rate-limit-2",
      },
    });

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "rate_limit_unavailable");
    assert.deepEqual(events, [
      {
        code: "rate_limit_backend_unavailable",
        failureClass: "system",
      },
    ]);
  });

  it("fails open on lower-risk routes when the limiter backend is unavailable", async () => {
    const events: Array<{ code: string; failureClass: string }> = [];
    const store = createStore(async () => {
      throw new Error("redis unavailable");
    });

    const app = createApiApp({
      store,
      onErrorEvent(event) {
        events.push({
          code: event.code,
          failureClass: event.failureClass,
        });
      },
    });

    const response = await app.request("http://localhost/v1/me", {
      headers: {
        "x-test-user-id": "user-rate-limit-3",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(events, [
      {
        code: "rate_limit_backend_unavailable",
        failureClass: "system",
      },
    ]);
  });

  it("shares export status limits across different export ids", async () => {
    const counts = new Map<string, number>();
    const store = createStore(async (key) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return {
        count,
        resetAt: Date.now() + 60_000,
      };
    });

    const app = createApiApp({ store });

    let lastResponse = await app.request("http://localhost/v1/exports/exp-0", {
      headers: {
        "x-test-user-id": "user-rate-limit-4",
      },
    });

    assert.equal(lastResponse.status, 200);

    for (let i = 0; i < 30; i += 1) {
      lastResponse = await app.request(`http://localhost/v1/exports/exp-${i + 1}`, {
        headers: {
          "x-test-user-id": "user-rate-limit-4",
        },
      });
    }

    assert.equal(lastResponse.status, 429);
  });

  it("applies the dedicated DOCX export request limit before the generic export limit", async () => {
    const counts = new Map<string, number>();
    const store = createStore(async (key) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return {
        count,
        resetAt: Date.now() + 60_000,
      };
    });

    const app = createApiApp({ store });

    let lastResponse = new Response(null, { status: 200 });

    for (let i = 0; i < 40; i += 1) {
      lastResponse = await app.request(
        `http://localhost/v1/documents/doc-${i}/exports/docx`,
        {
          method: "POST",
          headers: {
            "x-test-user-id": "user-rate-limit-5",
          },
        },
      );
    }

    assert.equal(lastResponse.status, 200);

    const blockedResponse = await app.request(
      "http://localhost/v1/documents/doc-40/exports/docx",
      {
        method: "POST",
        headers: {
          "x-test-user-id": "user-rate-limit-5",
        },
      },
    );

    assert.equal(blockedResponse.status, 429);
  });

  it("splits anonymous authenticated-route buckets by requester IP", async () => {
    const counts = new Map<string, number>();
    const store = createStore(async (key) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return {
        count,
        resetAt: Date.now() + 60_000,
      };
    });

    const app = createApiApp({ store });

    let lastResponse = new Response(null, { status: 200 });

    for (let i = 0; i < 20; i += 1) {
      lastResponse = await app.request(`http://localhost/v1/exports/exp-${i}/retry`, {
        headers: {
          "x-forwarded-for": "203.0.113.10",
        },
      });
    }

    assert.equal(lastResponse.status, 200);

    const differentIpResponse = await app.request(
      "http://localhost/v1/exports/exp-21/retry",
      {
        headers: {
          "x-forwarded-for": "203.0.113.11",
        },
      },
    );

    assert.equal(differentIpResponse.status, 200);
  });

  it("fails open for webhook IP limiting when the limiter backend is unavailable", async () => {
    const events: Array<{ code: string; failureClass: string }> = [];
    const store = createStore(async () => {
      throw new Error("redis unavailable");
    });

    const app = createWebhookApp({
      store,
      onErrorEvent(event) {
        events.push({
          code: event.code,
          failureClass: event.failureClass,
        });
      },
    });

    const response = await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(events, [
      {
        code: "rate_limit_backend_unavailable",
        failureClass: "system",
      },
    ]);
  });
});
