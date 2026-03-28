import { logLaunchEvent } from "@aqshara/observability";
import {
  createDatabase,
  documentSourceLinks,
  documents,
  sourcesTable,
} from "@aqshara/database";
import { and, eq } from "drizzle-orm";
import {
  getSourceJobRow,
  markSourceFailed,
  markSourceProcessing,
  markSourceReady,
} from "@aqshara/database/source-job";
import type { ParseSourcePayload } from "@aqshara/queue";
import {
  getSourceObjectBuffer,
  putSourceObject,
  sourceParsedTextKey,
} from "@aqshara/storage";
import { createHash } from "node:crypto";
import { UnrecoverableError } from "bullmq";
import {
  extractPdfPageTexts,
  pageIndicesNeedingOcr,
} from "../lib/pdf-text-extractor.ts";
import { runMistralOcrOnPdfKey } from "../lib/mistral-ocr.ts";
import { logWorkerSourceParseFailureEvent } from "./source-parse-error-event.ts";
import { getSourceParseFailureStrategy } from "./source-parse-failure-strategy.ts";

const PARSED_TEXT_CONTENT_TYPE = "text/plain; charset=utf-8";
const MAX_SOURCE_PAGES = 300;

type SourceJobRow = {
  id: string;
  userId: string;
  workspaceId: string;
  storageKey: string;
  status: "queued" | "processing" | "ready" | "failed";
  bullmqJobId: string | null;
};

type SourceParseDeps = {
  createDatabase: () => unknown;
  getSourceJobRow: (
    db: unknown,
    sourceId: string,
  ) => Promise<SourceJobRow | null>;
  getDocumentRow: (
    db: unknown,
    documentId: string,
  ) => Promise<{ workspaceId: string } | null>;
  getDocumentSourceLinkRow: (
    db: unknown,
    sourceId: string,
    documentId: string,
  ) => Promise<unknown | null>;
  markSourceFailed: (
    db: unknown,
    input: { sourceId: string; errorMessage: string; errorCode: string },
  ) => Promise<{ ok: true } | { ok: false }>;
  markSourceProcessing: (
    db: unknown,
    input: { sourceId: string; bullmqJobId: string },
  ) => Promise<unknown | null>;
  markSourceReady: (
    db: unknown,
    input: {
      sourceId: string;
      parsedTextStorageKey: string;
      pageCount: number;
      parsedTextSizeBytes: number;
    },
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  getSourceObjectBuffer: (key: string) => Promise<Buffer>;
  putSourceObject: (input: {
    key: string;
    body: Buffer;
    contentType: string;
  }) => Promise<void>;
  sourceParsedTextKey: (workspaceId: string, sourceId: string) => string;
  extractPdfPageTexts: typeof extractPdfPageTexts;
  pageIndicesNeedingOcr: typeof pageIndicesNeedingOcr;
  runMistralOcrOnPdfKey: typeof runMistralOcrOnPdfKey;
  logWorkerSourceParseFailureEvent: typeof logWorkerSourceParseFailureEvent;
  logLaunchEvent: typeof logLaunchEvent;
};

class SourceParseRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceParseRetryableError";
  }
}

async function getDocumentRow(
  db: unknown,
  documentId: string,
): Promise<{ workspaceId: string } | null> {
  const [docRow] = await (db as ReturnType<typeof createDatabase>)
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  return docRow ? { workspaceId: docRow.workspaceId } : null;
}

async function getDocumentSourceLinkRow(
  db: unknown,
  sourceId: string,
  documentId: string,
): Promise<unknown | null> {
  const [linkRow] = await (db as ReturnType<typeof createDatabase>)
    .select()
    .from(documentSourceLinks)
    .where(
      and(
        eq(documentSourceLinks.sourceId, sourceId),
        eq(documentSourceLinks.documentId, documentId),
      ),
    )
    .limit(1);

  return linkRow ?? null;
}

const defaultSourceParseDeps: SourceParseDeps = {
  createDatabase,
  getSourceJobRow: async (db, sourceId) =>
    (await getSourceJobRow(
      db as ReturnType<typeof createDatabase>,
      sourceId,
    )) as SourceJobRow | null,
  getDocumentRow,
  getDocumentSourceLinkRow,
  markSourceFailed: (db, input) =>
    markSourceFailed(db as ReturnType<typeof createDatabase>, input),
  markSourceProcessing: (db, input) =>
    markSourceProcessing(db as ReturnType<typeof createDatabase>, input),
  markSourceReady: (db, input) =>
    markSourceReady(db as ReturnType<typeof createDatabase>, input),
  getSourceObjectBuffer,
  putSourceObject,
  sourceParsedTextKey,
  extractPdfPageTexts,
  pageIndicesNeedingOcr,
  runMistralOcrOnPdfKey,
  logWorkerSourceParseFailureEvent,
  logLaunchEvent,
};

async function failSourceParseJob(input: {
  db: unknown;
  deps: SourceParseDeps;
  payload: ParseSourcePayload;
  bullmqJobId: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  attemptsMade: number;
  maxAttempts: number;
  failureClass?: "user" | "system";
}): Promise<never> {
  const strategy = getSourceParseFailureStrategy({
    retryable: input.retryable,
    attemptsMade: input.attemptsMade,
    maxAttempts: input.maxAttempts,
  });
  const terminal = strategy.markFailed || strategy.unrecoverable;

  input.deps.logWorkerSourceParseFailureEvent({
    payload: input.payload,
    jobId: input.bullmqJobId,
    code: input.errorCode,
    message: input.errorMessage,
    attemptsMade: input.attemptsMade,
    maxAttempts: input.maxAttempts,
    terminal,
    willRetry: input.retryable && !terminal,
    failureClass: input.failureClass,
  });

  if (strategy.markFailed) {
    await input.deps.markSourceFailed(input.db, {
      sourceId: input.payload.sourceId,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    });

    input.deps.logLaunchEvent("source.parse_failed", {
      sourceId: input.payload.sourceId,
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

  throw new SourceParseRetryableError(input.errorMessage);
}

async function markSourceFailedBestEffort(input: {
  db: unknown;
  deps: SourceParseDeps;
  sourceId: string;
  errorCode: string;
  errorMessage: string;
}): Promise<void> {
  try {
    await input.deps.markSourceFailed(input.db, {
      sourceId: input.sourceId,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    });
  } catch {
    // preserve original worker failure
  }
}

export async function processSourceParseJob(
  payload: ParseSourcePayload,
  bullmqJobId: string,
  attempt: { attemptsMade: number; maxAttempts: number } = {
    attemptsMade: 0,
    maxAttempts: 1,
  },
  deps: Partial<SourceParseDeps> = {},
): Promise<void> {
  const resolvedDeps = { ...defaultSourceParseDeps, ...deps };
  const db = resolvedDeps.createDatabase();
  const finalAttempt =
    attempt.attemptsMade + 1 >= Math.max(1, attempt.maxAttempts);
  const forceOcr = payload.forceOcr ?? false;

  let row;
  try {
    row = await resolvedDeps.getSourceJobRow(db, payload.sourceId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load source job";
    resolvedDeps.logWorkerSourceParseFailureEvent({
      payload,
      jobId: bullmqJobId,
      code: "source_lookup_failed",
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
    const message = `Source ${payload.sourceId} not found`;
    resolvedDeps.logWorkerSourceParseFailureEvent({
      payload,
      jobId: bullmqJobId,
      code: "source_not_found",
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
    row.workspaceId !== payload.workspaceId
  ) {
    await failSourceParseJob({
      db,
      deps: resolvedDeps,
      payload,
      bullmqJobId,
      errorCode: "payload_mismatch",
      errorMessage: "Job payload does not match source record",
      retryable: false,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
    });
  }

  if (row.status === "ready") {
    return;
  }

  const docRow = await resolvedDeps.getDocumentRow(db, payload.documentId);

  if (!docRow || docRow.workspaceId !== row.workspaceId) {
    await failSourceParseJob({
      db,
      deps: resolvedDeps,
      payload,
      bullmqJobId,
      errorCode: "document_workspace_mismatch",
      errorMessage: "Document not found for source workspace",
      retryable: false,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
      failureClass: "user",
    });
  }

  const linkRow = await resolvedDeps.getDocumentSourceLinkRow(
    db,
    payload.sourceId,
    payload.documentId,
  );

  if (!linkRow) {
    await failSourceParseJob({
      db,
      deps: resolvedDeps,
      payload,
      bullmqJobId,
      errorCode: "source_link_missing",
      errorMessage: "Source is not linked to the document in job payload",
      retryable: false,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
      failureClass: "user",
    });
  }

  let started;
  try {
    started = await resolvedDeps.markSourceProcessing(db, {
      sourceId: payload.sourceId,
      bullmqJobId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to transition source";
    resolvedDeps.logWorkerSourceParseFailureEvent({
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
      await markSourceFailedBestEffort({
        db,
        deps: resolvedDeps,
        sourceId: payload.sourceId,
        errorCode: "processing_transition_failed",
        errorMessage: message,
      });
      throw new UnrecoverableError(message);
    }
    throw error;
  }

  if (!started) {
    const again = await resolvedDeps.getSourceJobRow(db, payload.sourceId);
    if (again?.status === "ready") {
      return;
    }
    if (again?.status === "processing" && again.bullmqJobId === bullmqJobId) {
      // BullMQ reuses the same job id across retry attempts; continue processing.
    } else if (again?.status === "processing") {
      return;
    } else {
      const message = `Could not move source ${payload.sourceId} to processing`;
      resolvedDeps.logWorkerSourceParseFailureEvent({
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
        await markSourceFailedBestEffort({
          db,
          deps: resolvedDeps,
          sourceId: payload.sourceId,
          errorCode: "processing_transition_failed",
          errorMessage: message,
        });
        throw new UnrecoverableError(message);
      }
      throw new Error(message);
    }
  }

  try {
    let pdfBytes: Buffer;
    try {
      pdfBytes = await resolvedDeps.getSourceObjectBuffer(row.storageKey);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to read PDF from storage";
      await failSourceParseJob({
        db,
        deps: resolvedDeps,
        payload,
        bullmqJobId,
        errorCode: "storage_read_failed",
        errorMessage: message.slice(0, 2000),
        retryable: true,
        attemptsMade: attempt.attemptsMade,
        maxAttempts: attempt.maxAttempts,
      });
      throw new Error("unreachable");
    }

    // Validate checksum against the declared checksum stored in the sources row
    const sourceRow = row as Record<string, unknown>;
    const declaredChecksum = sourceRow.checksum as string | undefined;
    if (declaredChecksum) {
      const actualChecksum = createHash("sha256")
        .update(pdfBytes)
        .digest("hex");
      if (actualChecksum.toLowerCase() !== declaredChecksum.toLowerCase()) {
        await failSourceParseJob({
          db,
          deps: resolvedDeps,
          payload,
          bullmqJobId,
          errorCode: "checksum_mismatch",
          errorMessage: "File checksum does not match the declared checksum",
          retryable: false,
          attemptsMade: attempt.attemptsMade,
          maxAttempts: attempt.maxAttempts,
        });
      }
    }

    let extracted: Awaited<ReturnType<typeof extractPdfPageTexts>>;
    try {
      extracted = await resolvedDeps.extractPdfPageTexts(pdfBytes);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid or corrupt PDF";
      await failSourceParseJob({
        db,
        deps: resolvedDeps,
        payload,
        bullmqJobId,
        errorCode: "invalid_pdf",
        errorMessage: message.slice(0, 2000),
        retryable: false,
        attemptsMade: attempt.attemptsMade,
        maxAttempts: attempt.maxAttempts,
        failureClass: "user",
      });
      throw new Error("unreachable");
    }

    if (extracted.numPages > MAX_SOURCE_PAGES) {
      await failSourceParseJob({
        db,
        deps: resolvedDeps,
        payload,
        bullmqJobId,
        errorCode: "page_limit_exceeded",
        errorMessage: `PDF exceeds ${MAX_SOURCE_PAGES} pages`,
        retryable: false,
        attemptsMade: attempt.attemptsMade,
        maxAttempts: attempt.maxAttempts,
        failureClass: "user",
      });
    }

    const weakIndices = forceOcr
      ? extracted.pages.map((_, index) => index)
      : resolvedDeps.pageIndicesNeedingOcr(extracted.pages);
    let textOut = extracted.pages
      .map((page, index) => `## Page ${index + 1}\n\n${page}`)
      .join("\n\n");

    if (weakIndices.length > 0) {
      try {
        const ocr = await resolvedDeps.runMistralOcrOnPdfKey({
          storageKey: row.storageKey,
          pages: weakIndices,
        });
        if (ocr && ocr.pages.length > 0) {
          const mergedPages = [...extracted.pages];
          for (const page of ocr.pages) {
            if (page.index >= 0 && page.index < mergedPages.length) {
              mergedPages[page.index] = page.markdown.trim();
            }
          }
          textOut = mergedPages
            .map((pageText, index) => `## Page ${index + 1}\n\n${pageText}`)
            .join("\n\n");
        } else if (forceOcr) {
          await failSourceParseJob({
            db,
            deps: resolvedDeps,
            payload,
            bullmqJobId,
            errorCode: "ocr_forced_unavailable",
            errorMessage:
              "OCR was requested explicitly but no OCR output was available",
            retryable: true,
            attemptsMade: attempt.attemptsMade,
            maxAttempts: attempt.maxAttempts,
            failureClass: "system",
          });
        } else if (textOut.trim().length < 80) {
          await failSourceParseJob({
            db,
            deps: resolvedDeps,
            payload,
            bullmqJobId,
            errorCode: "insufficient_text",
            errorMessage:
              "Could not extract sufficient text (OCR unavailable or insufficient)",
            retryable: false,
            attemptsMade: attempt.attemptsMade,
            maxAttempts: attempt.maxAttempts,
            failureClass: "user",
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await failSourceParseJob({
          db,
          deps: resolvedDeps,
          payload,
          bullmqJobId,
          errorCode: "mistral_ocr_failed",
          errorMessage: message.slice(0, 2000),
          retryable: true,
          attemptsMade: attempt.attemptsMade,
          maxAttempts: attempt.maxAttempts,
        });
      }
    }

    if (textOut.trim().length < 20) {
      await failSourceParseJob({
        db,
        deps: resolvedDeps,
        payload,
        bullmqJobId,
        errorCode: "empty_extracted_text",
        errorMessage: "No meaningful text could be extracted",
        retryable: false,
        attemptsMade: attempt.attemptsMade,
        maxAttempts: attempt.maxAttempts,
        failureClass: "user",
      });
    }

    const parsedKey = resolvedDeps.sourceParsedTextKey(row.workspaceId, row.id);
    const body = Buffer.from(textOut, "utf8");

    await resolvedDeps.putSourceObject({
      key: parsedKey,
      body,
      contentType: PARSED_TEXT_CONTENT_TYPE,
    });

    const ready = await resolvedDeps.markSourceReady(db, {
      sourceId: payload.sourceId,
      parsedTextStorageKey: parsedKey,
      pageCount: extracted.numPages,
      parsedTextSizeBytes: body.length,
    });

    if (!ready.ok) {
      await failSourceParseJob({
        db,
        deps: resolvedDeps,
        payload,
        bullmqJobId,
        errorCode: "ready_transition_failed",
        errorMessage: "Could not finalize source as ready",
        retryable: false,
        attemptsMade: attempt.attemptsMade,
        maxAttempts: attempt.maxAttempts,
      });
    }

    resolvedDeps.logLaunchEvent("source.parse_ready", {
      sourceId: payload.sourceId,
      userId: payload.userId,
      documentId: payload.documentId,
      pageCount: extracted.numPages,
      parsedTextSizeBytes: body.length,
    });
  } catch (error) {
    if (
      error instanceof UnrecoverableError ||
      error instanceof SourceParseRetryableError
    ) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    await failSourceParseJob({
      db,
      deps: resolvedDeps,
      payload,
      bullmqJobId,
      errorCode: "source_parse_failed",
      errorMessage: message.slice(0, 2000),
      retryable: true,
      attemptsMade: attempt.attemptsMade,
      maxAttempts: attempt.maxAttempts,
    });
  }
}
