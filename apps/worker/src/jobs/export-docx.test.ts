import assert from "node:assert/strict";
import { describe, it } from "node:test";

async function captureErrorEvent<T>(
  action: () => T | Promise<T>,
): Promise<{ result: T; event: Record<string, unknown> }> {
  const lines: string[] = [];
  const originalInfo = console.info;

  console.info = ((value?: unknown, ...rest: unknown[]) => {
    lines.push([value, ...rest].map((entry) => String(entry)).join(" "));
  }) as typeof console.info;

  try {
    const result = await action();
    const event = lines
      .filter((line) => line.trim().startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((payload) => payload.type === "error_event");

    assert.ok(event, "expected worker helper to emit an error_event");
    return { result, event };
  } finally {
    console.info = originalInfo;
  }
}

describe("export DOCX failure strategy", () => {
  it("classifies terminal export failures as unrecoverable", async () => {
    let module: Record<string, unknown> | null = null;
    const strategyModulePath = "./export-docx-failure-strategy.js";
    try {
      module = (await import(strategyModulePath)) as Record<string, unknown>;
    } catch {
      module = null;
    }

    assert.ok(module, "expected failure strategy helper module");

    const getExportFailureStrategy = module.getExportFailureStrategy;

    assert.equal(
      typeof getExportFailureStrategy,
      "function",
      "expected worker export job module to expose failure strategy helper",
    );

    const outcome = (
      getExportFailureStrategy as (input: {
        retryable: boolean;
        attemptsMade: number;
        maxAttempts: number;
      }) => {
        markFailed: boolean;
        unrecoverable: boolean;
      }
    )({
      retryable: false,
      attemptsMade: 0,
      maxAttempts: 3,
    });

    assert.deepEqual(outcome, {
      markFailed: true,
      unrecoverable: true,
    });
  });

  it("keeps transient failures retryable until the last attempt", async () => {
    let module: Record<string, unknown> | null = null;
    const strategyModulePath = "./export-docx-failure-strategy.js";
    try {
      module = (await import(strategyModulePath)) as Record<string, unknown>;
    } catch {
      module = null;
    }

    assert.ok(module, "expected failure strategy helper module");

    const getExportFailureStrategy = module.getExportFailureStrategy as (input: {
      retryable: boolean;
      attemptsMade: number;
      maxAttempts: number;
    }) => {
      markFailed: boolean;
      unrecoverable: boolean;
    };

    const beforeLastAttempt = getExportFailureStrategy({
      retryable: true,
      attemptsMade: 0,
      maxAttempts: 3,
    });

    const lastAttempt = getExportFailureStrategy({
      retryable: true,
      attemptsMade: 2,
      maxAttempts: 3,
    });

    assert.deepEqual(beforeLastAttempt, {
      markFailed: false,
      unrecoverable: false,
    });
    assert.deepEqual(lastAttempt, {
      markFailed: true,
      unrecoverable: false,
    });
  });

  it("emits retryable worker error events with queue metadata", async () => {
    const errorEventModulePath = "./export-docx-error-event.js";
    const module = (await import(errorEventModulePath)) as {
      logWorkerExportFailureEvent: (input: {
        payload: {
          exportId: string;
          documentId: string;
          userId: string;
          workspaceId: string;
        };
        jobId: string;
        code: string;
        message: string;
        attemptsMade: number;
        maxAttempts: number;
        terminal: boolean;
        willRetry: boolean;
      }) => void;
    };

    assert.equal(
      typeof module.logWorkerExportFailureEvent,
      "function",
      "expected worker export job module to expose error-event helper",
    );

    const { event } = await captureErrorEvent(() =>
      module.logWorkerExportFailureEvent({
        payload: {
          exportId: "exp_retryable",
          documentId: "doc_retryable",
          userId: "user_retryable",
          workspaceId: "ws_retryable",
        },
        jobId: "job_retryable",
        code: "export_render_failed",
        message: "Provider timeout",
        attemptsMade: 0,
        maxAttempts: 3,
        terminal: false,
        willRetry: true,
      }),
    );

    assert.equal(event.domain, "worker");
    assert.equal(event.failureClass, "system");
    assert.equal(event.code, "export_render_failed");
    assert.equal(event.jobId, "job_retryable");
    assert.equal(event.exportId, "exp_retryable");
    assert.equal(event.documentId, "doc_retryable");
    assert.equal(event.userId, "user_retryable");
    assert.equal(event.attemptNumber, 1);
    assert.equal(event.maxAttempts, 3);
    assert.equal(event.terminal, false);
    assert.equal(event.willRetry, true);
  });

  it("emits terminal worker error events when export retries are exhausted", async () => {
    const errorEventModulePath = "./export-docx-error-event.js";
    const module = (await import(errorEventModulePath)) as {
      logWorkerExportFailureEvent: (input: {
        payload: {
          exportId: string;
          documentId: string;
          userId: string;
          workspaceId: string;
        };
        jobId: string;
        code: string;
        message: string;
        attemptsMade: number;
        maxAttempts: number;
        terminal: boolean;
        willRetry: boolean;
      }) => void;
    };

    const { event } = await captureErrorEvent(() =>
      module.logWorkerExportFailureEvent({
        payload: {
          exportId: "exp_terminal",
          documentId: "doc_terminal",
          userId: "user_terminal",
          workspaceId: "ws_terminal",
        },
        jobId: "job_terminal",
        code: "payload_mismatch",
        message: "Job payload does not match export record",
        attemptsMade: 0,
        maxAttempts: 3,
        terminal: true,
        willRetry: false,
      }),
    );

    assert.equal(event.domain, "worker");
    assert.equal(event.failureClass, "system");
    assert.equal(event.code, "payload_mismatch");
    assert.equal(event.jobId, "job_terminal");
    assert.equal(event.exportId, "exp_terminal");
    assert.equal(event.attemptNumber, 1);
    assert.equal(event.terminal, true);
    assert.equal(event.willRetry, false);
    assert.equal(event.message, "Job payload does not match export record");
  });
});
