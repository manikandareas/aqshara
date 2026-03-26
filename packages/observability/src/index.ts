type LogFields = Record<string, unknown> | undefined;
export type FailureClass = "user" | "system";

export type ErrorEventInput = {
  domain: string;
  failureClass: FailureClass;
  code: string;
  message?: string;
  requestId?: string;
  jobId?: string;
  userId?: string;
  documentId?: string;
  exportId?: string;
  path?: string;
  [key: string]: unknown;
};

export type Logger = {
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, error?: unknown, fields?: LogFields) => void;
};

function isJsonLogs(): boolean {
  return process.env.AQSHARA_LOG_FORMAT === "json";
}

export function createLogger(scope: string): Logger {
  return {
    info(message, fields) {
      if (isJsonLogs()) {
        console.info(
          JSON.stringify({ level: "info", scope, message, ...fields }),
        );
      } else if (fields && Object.keys(fields).length > 0) {
        console.info(`[${scope}] ${message}`, fields);
      } else {
        console.info(`[${scope}] ${message}`);
      }
    },
    warn(message, fields) {
      if (isJsonLogs()) {
        console.warn(
          JSON.stringify({ level: "warn", scope, message, ...fields }),
        );
      } else if (fields && Object.keys(fields).length > 0) {
        console.warn(`[${scope}] ${message}`, fields);
      } else {
        console.warn(`[${scope}] ${message}`);
      }
    },
    error(message, error, fields) {
      const errPayload =
        error instanceof Error
          ? { errName: error.name, errMessage: error.message }
          : error !== undefined
            ? { err: String(error) }
            : {};
      if (isJsonLogs()) {
        console.error(
          JSON.stringify({
            level: "error",
            scope,
            message,
            ...errPayload,
            ...fields,
          }),
        );
      } else {
        console.error(`[${scope}] ${message}`, error, fields);
      }
    },
  };
}

/** Structured launch funnel / product events (always one JSON line). */
export function logLaunchEvent(
  event: string,
  fields: Record<string, unknown> = {},
): void {
  console.info(
    JSON.stringify({
      type: "launch_event",
      event,
      ts: new Date().toISOString(),
      ...fields,
    }),
  );
}

/** Structured monitoring/error events (always one JSON line). */
export function logErrorEvent(input: ErrorEventInput): void {
  console.info(
    JSON.stringify({
      type: "error_event",
      ts: new Date().toISOString(),
      ...input,
    }),
  );
}
