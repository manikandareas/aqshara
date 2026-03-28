import { logLaunchEvent } from "@aqshara/observability";
import { createDatabase, documents } from "@aqshara/database";
import {
  getExportJobRow,
  markExportFailed,
  markExportProcessing,
  markExportReady,
} from "@aqshara/database/export-job";
import type { DocumentValue } from "@aqshara/documents";
import type { ExportDocxPayload } from "@aqshara/queue";
import { createStorageKey, writeExportFile } from "@aqshara/storage";
import { UnrecoverableError } from "bullmq";
import { eq } from "drizzle-orm";
import { renderDocumentValueToDocxBuffer } from "../render-docx.ts";
import { logWorkerExportFailureEvent } from "./export-docx-error-event.ts";
import { getExportFailureStrategy } from "./export-docx-failure-strategy.ts";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function failExportJob(input: {
  db: ReturnType<typeof createDatabase>;
  payload: ExportDocxPayload;
  bullmqJobId: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  attemptsMade: number;
  maxAttempts: number;
}): Promise<never> {
  const strategy = getExportFailureStrategy({
    retryable: input.retryable,
    attemptsMade: input.attemptsMade,
    maxAttempts: input.maxAttempts,
  });
  const terminal = strategy.markFailed || strategy.unrecoverable;

  logWorkerExportFailureEvent({
    payload: input.payload,
    jobId: input.bullmqJobId,
    code: input.errorCode,
    message: input.errorMessage,
    attemptsMade: input.attemptsMade,
    maxAttempts: input.maxAttempts,
    terminal,
    willRetry: input.retryable && !terminal,
  });

  if (strategy.markFailed) {
    await markExportFailed(input.db, {
      exportId: input.payload.exportId,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    });

    logLaunchEvent("export.docx_failed", {
      exportId: input.payload.exportId,
      userId: input.payload.userId,
      documentId: input.payload.documentId,
      errorCode: input.errorCode,
      attemptsMade: input.attemptsMade + 1,
      maxAttempts: input.maxAttempts,
    });
  }

  if (strategy.unrecoverable) {
    throw new UnrecoverableError(input.errorMessage);
  }

  throw new Error(input.errorMessage);
}

async function markExportFailedBestEffort(input: {
  db: ReturnType<typeof createDatabase>;
  exportId: string;
  errorCode: string;
  errorMessage: string;
}): Promise<void> {
  try {
    await markExportFailed(input.db, {
      exportId: input.exportId,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    });
  } catch {
    // Preserve the original worker failure if DB reconciliation also fails.
  }
}

export async function processExportDocxJob(
  payload: ExportDocxPayload,
  bullmqJobId: string,
  attempt: { attemptsMade: number; maxAttempts: number } = {
    attemptsMade: 0,
    maxAttempts: 1,
  },
): Promise<void> {
  const db = createDatabase();
  const finalAttempt =
    attempt.attemptsMade + 1 >= Math.max(1, attempt.maxAttempts);

  let row;
  try {
    row = await getExportJobRow(db, payload.exportId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load export job";
    logWorkerExportFailureEvent({
      payload,
      jobId: bullmqJobId,
      code: "export_lookup_failed",
      message,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
      terminal: finalAttempt,
      willRetry: !finalAttempt,
    });
    if (finalAttempt) {
      throw new UnrecoverableError(message);
    }
    throw error;
  }

  if (!row) {
    const message = `Export ${payload.exportId} not found`;
    logWorkerExportFailureEvent({
      payload,
      jobId: bullmqJobId,
      code: "export_not_found",
      message,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
      terminal: true,
      willRetry: false,
    });
    throw new UnrecoverableError(message);
  }

  if (
    row.userId !== payload.userId ||
    row.documentId !== payload.documentId ||
    row.workspaceId !== payload.workspaceId
  ) {
    await failExportJob({
      db,
      payload,
      bullmqJobId,
      errorCode: "payload_mismatch",
      errorMessage: "Job payload does not match export record",
      retryable: false,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
    });
  }

  if (row.status === "ready") {
    return;
  }

  let started;
  try {
    started = await markExportProcessing(db, {
      exportId: payload.exportId,
      bullmqJobId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to transition export";
    logWorkerExportFailureEvent({
      payload,
      jobId: bullmqJobId,
      code: "processing_transition_failed",
      message,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
      terminal: finalAttempt,
      willRetry: !finalAttempt,
    });
    if (finalAttempt) {
      await markExportFailedBestEffort({
        db,
        exportId: payload.exportId,
        errorCode: "processing_transition_failed",
        errorMessage: message,
      });
      throw new UnrecoverableError(message);
    }
    throw error;
  }

  if (!started) {
    let again;
    try {
      again = await getExportJobRow(db, payload.exportId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reload export job";
      logWorkerExportFailureEvent({
        payload,
        jobId: bullmqJobId,
        code: "processing_transition_lookup_failed",
        message,
        attemptsMade: attempt.attemptsMade,
        maxAttempts: attempt.maxAttempts,
        terminal: finalAttempt,
        willRetry: !finalAttempt,
      });
      if (finalAttempt) {
        await markExportFailedBestEffort({
          db,
          exportId: payload.exportId,
          errorCode: "processing_transition_lookup_failed",
          errorMessage: message,
        });
        throw new UnrecoverableError(message);
      }
      throw error;
    }
    if (again?.status === "ready") {
      return;
    }
    if (again?.status === "processing" && again.bullmqJobId === bullmqJobId) {
      // BullMQ keeps the same job id across retry attempts.
    } else if (again?.status === "processing") {
      return;
    }
    const message = `Could not move export ${payload.exportId} to processing`;
    logWorkerExportFailureEvent({
      payload,
      jobId: bullmqJobId,
      code: "processing_transition_failed",
      message,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
      terminal: finalAttempt,
      willRetry: !finalAttempt,
    });
    if (finalAttempt) {
      await markExportFailedBestEffort({
        db,
        exportId: payload.exportId,
        errorCode: "processing_transition_failed",
        errorMessage: message,
      });
      throw new UnrecoverableError(message);
    }
    throw new Error(message);
  }

  try {
    const [docRow] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, payload.documentId))
      .limit(1);

    if (!docRow) {
      return await failExportJob({
        db,
        payload,
        bullmqJobId,
        errorCode: "document_missing",
        errorMessage: "Document not found",
        retryable: false,
        attemptsMade: attempt.attemptsMade,
        maxAttempts: attempt.maxAttempts,
      });
    }

    const value = docRow.contentJson as DocumentValue;
    const buffer = await renderDocumentValueToDocxBuffer({
      title: docRow.title,
      value,
    });

    const storageKey = createStorageKey(
      "exports",
      payload.userId,
      `${payload.exportId}.docx`,
    );

    await writeExportFile(storageKey, buffer);

    const ready = await markExportReady(db, {
      exportId: payload.exportId,
      storageKey,
      contentType: DOCX_CONTENT_TYPE,
      fileSizeBytes: buffer.length,
    });

    if (!ready.ok) {
      await failExportJob({
        db,
        payload,
        bullmqJobId,
        errorCode: "ready_transition_failed",
        errorMessage: "Could not finalize export as ready",
        retryable: false,
        attemptsMade: attempt.attemptsMade,
        maxAttempts: attempt.maxAttempts,
      });
    } else {
      logLaunchEvent("export.docx_ready", {
        exportId: payload.exportId,
        userId: payload.userId,
        documentId: payload.documentId,
        fileSizeBytes: buffer.length,
      });
    }
  } catch (error) {
    if (error instanceof UnrecoverableError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    await failExportJob({
      db,
      payload,
      bullmqJobId,
      errorCode: "export_render_failed",
      errorMessage: message.slice(0, 2000),
      retryable: true,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
    });
  }
}
