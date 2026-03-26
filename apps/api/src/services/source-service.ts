import { parseSourcePayloadSchema, type ParseSourcePayload } from "@aqshara/queue";
import {
  deleteSourceObject,
  getSourceObjectBuffer,
  headSourceObject,
  isR2ObjectStorageConfigured,
  presignPutSourceObject,
  sourceOriginalKey,
} from "@aqshara/storage";
import { createHash, randomUUID } from "node:crypto";
import { logLaunchEvent } from "@aqshara/observability";
import type {
  AppRepository,
  AppSource,
} from "../repositories/app-repository.types.js";
import { getCurrentBillingPeriod } from "../repositories/billing-period.js";

const PDF_MIME = "application/pdf";
const MAX_SOURCE_FILE_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_PAGES = 300;

async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    verbosity: 0,
  });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

function computeSha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export class SourceService {
  constructor(
    private readonly repository: AppRepository,
    private readonly enqueueParse: (
      payload: ParseSourcePayload,
    ) => Promise<{ jobId: string }>,
  ) {}

  async createUploadUrl(input: {
    userId: string;
    workspaceId: string;
  }): Promise<
    | {
        type: "ok";
        sourceId: string;
        storageKey: string;
        uploadUrl: string;
        expiresInSeconds: number;
      }
    | { type: "storage_not_configured" }
    | { type: "workspace_mismatch" }
  > {
    const workspace = await this.repository.getWorkspaceForUser(input.userId);
    if (!workspace || workspace.id !== input.workspaceId) {
      return { type: "workspace_mismatch" };
    }

    if (!isR2ObjectStorageConfigured()) {
      return { type: "storage_not_configured" };
    }

    const sourceId = randomUUID();
    const storageKey = sourceOriginalKey(input.workspaceId, sourceId);
    const { url } = await presignPutSourceObject({
      key: storageKey,
      contentType: PDF_MIME,
      expiresSeconds: 900,
    });

    logLaunchEvent("source.upload_url_issued", {
      userId: input.userId,
      workspaceId: input.workspaceId,
      sourceId,
    });

    return {
      type: "ok",
      sourceId,
      storageKey,
      uploadUrl: url,
      expiresInSeconds: 900,
    };
  }

  private async enqueueParseJob(input: {
    source: AppSource;
    documentId: string;
    idempotencyKey: string;
  }): Promise<
    | { type: "ok"; source: AppSource }
    | { type: "queue_unavailable"; message: string }
  > {
    const payload = parseSourcePayloadSchema.parse({
      sourceId: input.source.id,
      documentId: input.documentId,
      userId: input.source.userId,
      workspaceId: input.source.workspaceId,
      idempotencyKey: input.idempotencyKey,
    } satisfies ParseSourcePayload);

    try {
      const { jobId } = await this.enqueueParse(payload);
      const updated = await this.repository.setSourceBullmqJobId({
        userId: input.source.userId,
        sourceId: input.source.id,
        bullmqJobId: jobId,
      });
      return { type: "ok", source: updated ?? input.source };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to enqueue parse job";
      await this.repository.markSourceFailedFromApi({
        userId: input.source.userId,
        sourceId: input.source.id,
        errorCode: "queue_enqueue_failed",
        errorMessage,
      });
      return {
        type: "queue_unavailable",
        message: "Source parse queue is temporarily unavailable",
      };
    }
  }

  async registerSource(input: {
    userId: string;
    workspaceId: string;
    documentId: string;
    sourceId: string;
    storageKey: string;
    originalFileName: string;
    fileSizeBytes: number;
    checksum: string;
    mimeType: string;
    idempotencyKey: string | null;
  }): Promise<
    | { type: "ok"; source: AppSource; isReplay: boolean; relinked: boolean }
    | {
        type:
          | "document_not_found"
          | "workspace_mismatch"
          | "object_missing"
          | "object_invalid"
          | "invalid_pdf"
          | "limits_exceeded"
          | "quota_exceeded"
          | "too_many_in_flight"
          | "storage_unavailable"
          | "queue_unavailable"
          | "idempotency_mismatch";
        message?: string;
      }
  > {
    if (input.mimeType !== PDF_MIME) {
      return { type: "invalid_pdf", message: "Only application/pdf is supported" };
    }

    if (
      input.fileSizeBytes < 1 ||
      input.fileSizeBytes > MAX_SOURCE_FILE_BYTES
    ) {
      return { type: "limits_exceeded", message: "File size is out of allowed range" };
    }

    const document = await this.repository.getDocumentById({
      userId: input.userId,
      documentId: input.documentId,
    });

    if (!document) {
      return { type: "document_not_found" };
    }

    if (document.workspaceId !== input.workspaceId) {
      return { type: "workspace_mismatch" };
    }

    const expectedKey = sourceOriginalKey(input.workspaceId, input.sourceId);
    if (input.storageKey !== expectedKey) {
      return {
        type: "object_invalid",
        message: "storageKey does not match sourceId and workspace",
      };
    }

    if (input.idempotencyKey) {
      const existing = await this.repository.getSourceByUserIdempotency({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      });
      if (existing) {
        if (existing.id !== input.sourceId) {
          return { type: "idempotency_mismatch" };
        }
        const link = await this.repository.createDocumentSourceLink({
          documentId: input.documentId,
          sourceId: existing.id,
        });
        if (link.ok === false && link.reason === "duplicate_link") {
          return {
            type: "ok",
            source: existing,
            isReplay: true,
            relinked: false,
          };
        }
        if (
          existing.status === "failed" &&
          existing.errorCode === "queue_enqueue_failed"
        ) {
          const retried = await this.repository.retryFailedSource({
            userId: input.userId,
            sourceId: existing.id,
          });
          if (!retried.ok) {
            if (
              retried.reason === "quota_exceeded" ||
              retried.reason === "too_many_in_flight"
            ) {
              return { type: retried.reason };
            }
            return {
              type: "queue_unavailable",
              message: "Failed to recover previous source registration",
            };
          }
          const idem = input.idempotencyKey ?? `register:${existing.id}`;
          const queued = await this.enqueueParseJob({
            source: retried.source,
            documentId: input.documentId,
            idempotencyKey: idem,
          });
          if (queued.type === "queue_unavailable") {
            return queued;
          }
          return {
            type: "ok",
            source: queued.source,
            isReplay: false,
            relinked: false,
          };
        }
        if (existing.status === "queued" && !existing.bullmqJobId) {
          const idem = input.idempotencyKey ?? `register:${existing.id}`;
          const queued = await this.enqueueParseJob({
            source: existing,
            documentId: input.documentId,
            idempotencyKey: idem,
          });
          if (queued.type === "queue_unavailable") {
            return queued;
          }
          return {
            type: "ok",
            source: queued.source,
            isReplay: true,
            relinked: false,
          };
        }
        return {
          type: "ok",
          source: existing,
          isReplay: true,
          relinked: false,
        };
      }
    }

    const head = await headSourceObject(input.storageKey);
    if (!head) {
      return { type: "object_missing", message: "Uploaded object was not found" };
    }

    const ct = head.contentType ?? "";
    if (ct !== PDF_MIME && ct !== "application/octet-stream") {
      return {
        type: "object_invalid",
        message: `Expected ${PDF_MIME}, got ${ct || "unknown"}`,
      };
    }

    if (head.size !== input.fileSizeBytes) {
      return {
        type: "object_invalid",
        message: "Uploaded size does not match declared fileSizeBytes",
      };
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await getSourceObjectBuffer(input.storageKey);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to read uploaded object from storage";
      return {
        type: "storage_unavailable",
        message,
      };
    }

    const checksum = computeSha256Hex(pdfBuffer);
    if (checksum.toLowerCase() !== input.checksum.toLowerCase()) {
      return {
        type: "object_invalid",
        message: "Uploaded checksum does not match declared checksum",
      };
    }

    let pageCount: number;
    try {
      pageCount = await getPdfPageCount(pdfBuffer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Uploaded file is not a valid PDF";
      return {
        type: "invalid_pdf",
        message,
      };
    }

    if (pageCount > MAX_SOURCE_PAGES) {
      return {
        type: "limits_exceeded",
        message: `PDF exceeds ${MAX_SOURCE_PAGES} pages`,
      };
    }

    const readyDup = await this.repository.findReadySourceByWorkspaceChecksum({
      workspaceId: input.workspaceId,
      checksum,
    });

    if (readyDup && readyDup.id !== input.sourceId) {
      const link = await this.repository.createDocumentSourceLink({
        documentId: input.documentId,
        sourceId: readyDup.id,
      });
      if (!link.ok && link.reason === "duplicate_link") {
        // already linked
      }
      await deleteSourceObject(input.storageKey).catch(() => undefined);
      logLaunchEvent("source.register_relinked", {
        userId: input.userId,
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        sourceId: readyDup.id,
        abandonedSourceId: input.sourceId,
      });
      return {
        type: "ok",
        source: readyDup,
        isReplay: false,
        relinked: true,
      };
    }

    const allowed = await this.repository.assertSourceRegistrationAllowed(
      input.userId,
    );
    if (!allowed.ok) {
      return { type: allowed.reason };
    }

    const period = getCurrentBillingPeriod();
    const inserted = await this.repository.insertQueuedSourceWithLink({
      id: input.sourceId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      documentId: input.documentId,
      billingPeriod: period,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      originalFileName: input.originalFileName,
      fileSizeBytes: input.fileSizeBytes,
      checksum,
      pageCount,
      idempotencyKey: input.idempotencyKey,
    });

    let source = inserted.source;
    if (inserted.ok === false && inserted.reason === "idempotency_replay") {
      source = inserted.source;
      const link = await this.repository.createDocumentSourceLink({
        documentId: input.documentId,
        sourceId: source.id,
      });
      if (!link.ok && link.reason !== "duplicate_link") {
        return {
          type: "queue_unavailable",
          message: "Failed to link document to source",
        };
      }
      if (source.status === "queued" && !source.bullmqJobId) {
        const idem = input.idempotencyKey ?? `register:${source.id}`;
        const queued = await this.enqueueParseJob({
          source,
          documentId: input.documentId,
          idempotencyKey: idem,
        });
        if (queued.type === "queue_unavailable") {
          return queued;
        }
        return {
          type: "ok",
          source: queued.source,
          isReplay: true,
          relinked: false,
        };
      }
      return {
        type: "ok",
        source,
        isReplay: true,
        relinked: false,
      };
    }

    const idem =
      input.idempotencyKey ?? `register:${input.sourceId}:${input.documentId}`;
    const queued = await this.enqueueParseJob({
      source,
      documentId: input.documentId,
      idempotencyKey: idem,
    });

    if (queued.type === "queue_unavailable") {
      return queued;
    }

    logLaunchEvent("source.registered", {
      userId: input.userId,
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      sourceId: source.id,
    });

    return {
      type: "ok",
      source: queued.source,
      isReplay: false,
      relinked: false,
    };
  }

  async getStatus(input: {
    userId: string;
    sourceId: string;
  }): Promise<AppSource | null> {
    return this.repository.getSourceForUser(input);
  }

  async listForDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<AppSource[]> {
    return this.repository.listSourcesForDocument(input);
  }

  async retry(input: {
    userId: string;
    sourceId: string;
  }): Promise<
    | { type: "ok"; source: AppSource }
    | {
        type:
          | "not_found"
          | "not_failed"
          | "quota_exceeded"
          | "too_many_in_flight"
          | "queue_unavailable";
        message?: string;
      }
  > {
    const retried = await this.repository.retryFailedSource({
      userId: input.userId,
      sourceId: input.sourceId,
    });

    if (!retried.ok) {
      return { type: retried.reason };
    }

    const source = retried.source;
    const resolvedDocumentId = await this.repository.getDocumentIdForSource({
      userId: input.userId,
      sourceId: source.id,
    });
    if (!resolvedDocumentId) {
      return {
        type: "queue_unavailable",
        message: "Could not resolve document for source retry",
      };
    }

    const idempotencyKey = `retry:${source.id}:${source.retryCount}`;
    const queued = await this.enqueueParseJob({
      source,
      documentId: resolvedDocumentId,
      idempotencyKey,
    });

    if (queued.type === "queue_unavailable") {
      return queued;
    }

    logLaunchEvent("source.retry_queued", {
      userId: input.userId,
      sourceId: source.id,
      documentId: resolvedDocumentId,
    });

    return { type: "ok", source: queued.source };
  }

  async delete(input: {
    userId: string;
    sourceId: string;
  }): Promise<
    | { type: "ok" }
    | { type: "not_found" | "already_deleted" }
  > {
    const before = await this.repository.getSourceForUser({
      userId: input.userId,
      sourceId: input.sourceId,
    });
    const result = await this.repository.softDeleteSource(input);
    if (!result.ok) {
      return { type: result.reason };
    }

    if (before) {
      await deleteSourceObject(before.storageKey).catch(() => undefined);
      if (before.parsedTextStorageKey) {
        await deleteSourceObject(before.parsedTextStorageKey).catch(
          () => undefined,
        );
      }
    }

    logLaunchEvent("source.deleted", {
      userId: input.userId,
      sourceId: input.sourceId,
    });

    return { type: "ok" };
  }
}
