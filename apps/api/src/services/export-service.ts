import type { DocumentValue } from "@aqshara/documents";
import { exportDocxPayloadSchema, type ExportDocxPayload } from "@aqshara/queue";
import type {
  AppDocument,
  AppExport,
  AppRepository,
  PreflightWarning,
} from "../repositories/app-repository.types.js";

const PLACEHOLDER_RE =
  /\b(TODO|TBD|FIXME|___+)\b|\{\{[^}]+\}\}|Lorem ipsum dolor sit amet/i;

function blockPlainText(block: DocumentValue[number]): string {
  if (block.type === "bullet-list") {
    return block.children.map((li) => li.children.map((t) => t.text).join("")).join(" ");
  }
  return block.children.map((c) => c.text).join("");
}

export function computeExportPreflight(document: AppDocument): PreflightWarning[] {
  const warnings: PreflightWarning[] = [];

  if (!document.title.trim()) {
    warnings.push({
      code: "empty_document_title",
      message: "Document title is empty or whitespace",
    });
  }

  const value = document.contentJson as DocumentValue;

  for (const block of value) {
    const text = blockPlainText(block).trim();
    const id = block.id;

    if (block.type === "heading" && text.length === 0) {
      warnings.push({
        code: "empty_heading",
        message: "A heading block has no visible text",
        blockId: id,
      });
    }

    if (PLACEHOLDER_RE.test(text)) {
      warnings.push({
        code: "possible_placeholder",
        message: "Possible unfinished placeholder text detected",
        blockId: id,
      });
    }
  }

  return warnings;
}

export class ExportService {
  constructor(
    private readonly repository: AppRepository,
    private readonly enqueueExport: (
      payload: ExportDocxPayload,
    ) => Promise<{ jobId: string }>,
  ) {}

  async preflightDocxExport(input: {
    userId: string;
    workspaceId: string;
    documentId: string;
  }): Promise<
    | { type: "ok"; warnings: PreflightWarning[] }
    | { type: "document_not_found" }
    | { type: "workspace_mismatch" }
  > {
    const document = await this.repository.getDocumentByIdUnscoped(
      input.documentId,
    );

    if (!document) {
      return { type: "document_not_found" };
    }

    if (document.workspaceId !== input.workspaceId) {
      return { type: "workspace_mismatch" };
    }

    return {
      type: "ok",
      warnings: computeExportPreflight(document),
    };
  }

  private async enqueueDocxExport(input: {
    export: AppExport;
    userId: string;
    workspaceId: string;
    documentId: string;
    idempotencyKey: string;
  }): Promise<
    | { type: "ok"; export: AppExport }
    | { type: "queue_unavailable"; message: string }
  > {
    const payload = exportDocxPayloadSchema.parse({
      exportId: input.export.id,
      documentId: input.documentId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      idempotencyKey: input.idempotencyKey,
    } satisfies ExportDocxPayload);

    try {
      const { jobId } = await this.enqueueExport(payload);
      await this.repository.setExportBullmqJobId({
        userId: input.userId,
        exportId: input.export.id,
        bullmqJobId: jobId,
      });
      const updated = await this.repository.getExportForUser({
        userId: input.userId,
        exportId: input.export.id,
      });
      return {
        type: "ok",
        export: updated!,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to enqueue export job";
      await this.repository.markExportFailed({
        userId: input.userId,
        exportId: input.export.id,
        errorCode: "queue_enqueue_failed",
        errorMessage,
      });
      return {
        type: "queue_unavailable",
        message: "Export queue is temporarily unavailable",
      };
    }
  }

  async requestDocxExport(input: {
    userId: string;
    workspaceId: string;
    documentId: string;
    idempotencyKey: string;
  }): Promise<
    | { type: "ok"; export: AppExport; isReplay: boolean }
    | { type: "document_not_found" }
    | { type: "workspace_mismatch" }
    | { type: "quota_exceeded" }
    | { type: "too_many_in_flight" }
    | { type: "queue_unavailable"; message: string }
  > {
    const document = await this.repository.getDocumentByIdUnscoped(
      input.documentId,
    );

    if (!document) {
      return { type: "document_not_found" };
    }

    if (document.workspaceId !== input.workspaceId) {
      return { type: "workspace_mismatch" };
    }

    const preflightWarnings = computeExportPreflight(document);

    const created = await this.repository.requestDocxExport({
      userId: input.userId,
      documentId: input.documentId,
      workspaceId: input.workspaceId,
      idempotencyKey: input.idempotencyKey,
      preflightWarnings,
    });

    if (!created.ok) {
      return { type: created.reason };
    }

    let exportRecord = created.export;
    let isReplay = created.isReplay;

    if (
      created.isReplay &&
      created.export.status === "failed" &&
      created.export.errorCode === "queue_enqueue_failed"
    ) {
      const retried = await this.repository.retryFailedExport({
        userId: input.userId,
        exportId: created.export.id,
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
          message: "Failed to recover previous export request",
        };
      }

      exportRecord = retried.export;
      isReplay = false;
    }

    if (isReplay) {
      return {
        type: "ok",
        export: exportRecord,
        isReplay: true,
      };
    }

    const queued = await this.enqueueDocxExport({
      export: exportRecord,
      userId: input.userId,
      workspaceId: input.workspaceId,
      documentId: document.id,
      idempotencyKey: input.idempotencyKey,
    });

    if (queued.type === "queue_unavailable") {
      return queued;
    }

    return {
      type: "ok",
      export: queued.export,
      isReplay: false,
    };
  }

  async getExport(input: {
    userId: string;
    exportId: string;
  }): Promise<AppExport | null> {
    return this.repository.getExportForUser(input);
  }

  async listExports(input: {
    userId: string;
    limit: number;
  }): Promise<AppExport[]> {
    return this.repository.listExportsForUser(input);
  }

  async retryExport(input: {
    userId: string;
    exportId: string;
  }): Promise<
    | { type: "ok"; export: AppExport }
    | {
        type:
          | "not_found"
          | "not_failed"
          | "quota_exceeded"
          | "too_many_in_flight";
      }
    | { type: "queue_unavailable"; message: string }
  > {
    const retried = await this.repository.retryFailedExport({
      userId: input.userId,
      exportId: input.exportId,
    });

    if (!retried.ok) {
      return { type: retried.reason };
    }

    const idempotencyKey =
      retried.export.idempotencyKey ?? `retry:${retried.export.id}`;

    const queued = await this.enqueueDocxExport({
      export: retried.export,
      userId: input.userId,
      workspaceId: retried.export.workspaceId,
      documentId: retried.export.documentId,
      idempotencyKey,
    });

    if (queued.type === "queue_unavailable") {
      return queued;
    }

    return { type: "ok", export: queued.export };
  }
}
