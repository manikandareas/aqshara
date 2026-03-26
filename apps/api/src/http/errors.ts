export function createErrorPayload(
  code: string,
  message: string,
  requestId: string,
) {
  return {
    code,
    message,
    requestId,
  };
}

export function getRequestId(c: {
  req: { header: (name: string) => string | undefined };
}) {
  return c.req.header("x-request-id") ?? "local";
}
