import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSourceParseFailureStrategy } from "./source-parse-failure-strategy.js";

describe("source parse failure strategy", () => {
  it("marks non-retryable failures terminal immediately", () => {
    const s = getSourceParseFailureStrategy({
      retryable: false,
      attemptsMade: 0,
      maxAttempts: 3,
    });
    assert.equal(s.markFailed, true);
    assert.equal(s.unrecoverable, true);
  });

  it("retries retryable failures until the last attempt", () => {
    const mid = getSourceParseFailureStrategy({
      retryable: true,
      attemptsMade: 0,
      maxAttempts: 3,
    });
    assert.equal(mid.markFailed, false);
    assert.equal(mid.unrecoverable, false);

    const last = getSourceParseFailureStrategy({
      retryable: true,
      attemptsMade: 2,
      maxAttempts: 3,
    });
    assert.equal(last.markFailed, true);
    assert.equal(last.unrecoverable, false);
  });
});
