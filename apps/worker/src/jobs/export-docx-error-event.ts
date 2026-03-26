import { logErrorEvent } from "@aqshara/observability";
import type { ExportDocxPayload } from "@aqshara/queue";

export function logWorkerExportFailureEvent(input: {
  payload: Pick<
    ExportDocxPayload,
    "exportId" | "documentId" | "userId" | "workspaceId"
  >;
  jobId: string;
  code: string;
  message: string;
  attemptsMade: number;
  maxAttempts: number;
  terminal: boolean;
  willRetry: boolean;
}): void {
  logErrorEvent({
    domain: "worker",
    failureClass: "system",
    code: input.code,
    jobId: input.jobId,
    exportId: input.payload.exportId,
    documentId: input.payload.documentId,
    userId: input.payload.userId,
    workspaceId: input.payload.workspaceId,
    message: input.message,
    attemptNumber: input.attemptsMade + 1,
    maxAttempts: input.maxAttempts,
    terminal: input.terminal,
    willRetry: input.willRetry,
    workerJob: "export_docx",
  });
}
