import assert from "node:assert/strict";
import test from "node:test";
import { ApiRequestError, fetchSession } from "./api.ts";

test("fetchSession exposes structured provisioning errors", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "account_provisioning",
        message: "Account provisioning is still pending",
        requestId: "test-request",
      }),
      {
        status: 409,
        headers: {
          "content-type": "application/json",
        },
      },
    );

  try {
    await assert.rejects(
      () => fetchSession("token"),
      (error: unknown) =>
        error instanceof ApiRequestError
        && error.status === 409
        && error.code === "account_provisioning"
        && error.message === "Account provisioning is still pending",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
