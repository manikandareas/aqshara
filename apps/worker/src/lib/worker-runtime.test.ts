import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getWorkerRuntimeConfig } from "./worker-runtime.js";

describe("worker runtime config", () => {
  it("uses defaults when optional env vars are absent", () => {
    const config = getWorkerRuntimeConfig({
      env: {},
      nodeEnv: "development",
      r2Configured: false,
      mistralApiKey: null,
    });

    assert.equal(config.recoveryStaleMs, 15 * 60 * 1000);
    assert.equal(config.mistralOcrTimeoutMs, 45 * 1000);
    assert.equal(config.productionLike, false);
    assert.equal(config.r2Configured, false);
    assert.equal(config.mistralOcrConfigured, false);
  });

  it("requires R2 in production", () => {
    assert.throws(
      () =>
        getWorkerRuntimeConfig({
          env: {},
          nodeEnv: "production",
          r2Configured: false,
          mistralApiKey: null,
        }),
      /requires R2 object storage in production/,
    );
  });

  it("requires R2 when OCR credentials are configured", () => {
    assert.throws(
      () =>
        getWorkerRuntimeConfig({
          env: {},
          nodeEnv: "development",
          r2Configured: false,
          mistralApiKey: "mistral_test_key",
        }),
      /MISTRAL_API_KEY requires R2 object storage/,
    );
  });

  it("rejects invalid positive integer env values", () => {
    assert.throws(
      () =>
        getWorkerRuntimeConfig({
          env: { WORKER_RECOVERY_STALE_MS: "0" },
          nodeEnv: "development",
          r2Configured: false,
          mistralApiKey: null,
        }),
      /WORKER_RECOVERY_STALE_MS must be a positive integer/,
    );
  });
});
