import type { FailureClass } from "@aqshara/observability";
import { logErrorEvent } from "@aqshara/observability";

function getApiErrorDomain(path: string): string {
  if (path.includes("/exports")) {
    return "export";
  }
  if (path.includes("/sources")) {
    return "source";
  }
  if (path.includes("/ai/") || path.includes("/outline/")) {
    return "ai";
  }
  if (path.includes("/content")) {
    return "document_save";
  }
  if (path.includes("/session") || path.includes("/webhooks")) {
    return "auth";
  }
  return "api";
}

export function logApiErrorEvent(input: {
  domain?: string;
  path: string;
  requestId: string;
  code: string;
  failureClass: FailureClass;
  message?: string;
  [key: string]: unknown;
}): void {
  logErrorEvent({
    domain: input.domain ?? getApiErrorDomain(input.path),
    ...input,
  });
}
