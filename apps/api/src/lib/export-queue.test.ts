import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("export queue configuration", () => {
  it("defines a retry policy for DOCX export jobs", async () => {
    const module = (await import("./export-queue.js")) as Record<string, unknown>;
    const getExportQueueJobOptions = module.getExportQueueJobOptions;

    assert.equal(
      typeof getExportQueueJobOptions,
      "function",
      "expected export queue module to expose retry job options",
    );

    const options = (
      getExportQueueJobOptions as () => {
        attempts: number;
        backoff: { type: string; delay: number };
      }
    )();

    assert.ok(options.attempts >= 3);
    assert.deepEqual(options.backoff, {
      type: "exponential",
      delay: 2000,
    });
  });
});
