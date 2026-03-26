import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { logErrorEvent } from "./index.js";

describe("logErrorEvent", () => {
  it("emits a stable machine-readable error_event payload", () => {
    const lines: string[] = [];
    const originalInfo = console.info;

    console.info = (value?: unknown) => {
      lines.push(String(value));
    };

    try {
      logErrorEvent({
        domain: "export",
        failureClass: "system",
        code: "queue_unavailable",
        requestId: "req_123",
        exportId: "exp_123",
        message: "Failed to enqueue export job",
      });
    } finally {
      console.info = originalInfo;
    }

    assert.equal(lines.length, 1);

    const payload = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    assert.equal(payload.type, "error_event");
    assert.equal(payload.domain, "export");
    assert.equal(payload.failureClass, "system");
    assert.equal(payload.code, "queue_unavailable");
    assert.equal(payload.requestId, "req_123");
    assert.equal(payload.exportId, "exp_123");
    assert.equal(payload.message, "Failed to enqueue export job");
    assert.equal(typeof payload.ts, "string");
  });
});
