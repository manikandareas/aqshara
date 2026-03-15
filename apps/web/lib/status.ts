export function getStatusTone(status: string) {
  if (status === "ready" || status === "completed" || status === "done") {
    return "success" as const;
  }

  if (status === "error" || status === "failed" || status === "canceled") {
    return "danger" as const;
  }

  if (status === "processing" || status === "queued" || status === "pending") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export function isDocumentTerminal(status: string | undefined) {
  return status === "ready" || status === "error";
}

export function isVideoTerminal(status: string | undefined) {
  return status === "completed" || status === "failed" || status === "canceled";
}
