import { logErrorEvent, type FailureClass } from "@aqshara/observability";
import type { ParseSourcePayload } from "@aqshara/queue";

export function logWorkerSourceParseFailureEvent(input: {
  payload: Pick<
    ParseSourcePayload,
    "sourceId" | "documentId" | "userId" | "workspaceId"
  >;
  jobId: string;
  code: string;
  message: string;
  attemptsMade: number;
  maxAttempts: number;
  terminal: boolean;
  willRetry: boolean;
  failureClass?: FailureClass;
}): void {
  logErrorEvent({
    domain: "worker",
    failureClass: input.failureClass ?? "system",
    code: input.code,
    jobId: input.jobId,
    sourceId: input.payload.sourceId,
    documentId: input.payload.documentId,
    userId: input.payload.userId,
    workspaceId: input.payload.workspaceId,
    message: input.message,
    attemptNumber: input.attemptsMade + 1,
    maxAttempts: input.maxAttempts,
    terminal: input.terminal,
    willRetry: input.willRetry,
    workerJob: "parse_source",
  });
}
