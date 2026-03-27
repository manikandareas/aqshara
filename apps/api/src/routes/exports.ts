import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { logLaunchEvent } from "@aqshara/observability";
import {
  readExportFile,
  isR2ObjectStorageConfigured,
  presignGetExportObject,
} from "@aqshara/storage";
import { ErrorSchema } from "../openapi/schemas/common.js";
import { documentParamsSchema } from "../openapi/schemas/documents.js";
import {
  ExportSchema,
  PreflightWarningSchema,
} from "../openapi/schemas/exports.js";
import type { ApiEnv } from "../hono-env.js";
import type { AppExport } from "../repositories/app-repository.types.js";
import {
  createErrorPayload,
  getRequestId,
  requireAppUser,
} from "../http/api-http.js";
import { logApiErrorEvent } from "../lib/error-events.js";

function exportToJson(exp: AppExport) {
  return {
    id: exp.id,
    documentId: exp.documentId,
    userId: exp.userId,
    workspaceId: exp.workspaceId,
    billingPeriod: exp.billingPeriod,
    format: exp.format,
    status: exp.status,
    idempotencyKey: exp.idempotencyKey,
    bullmqJobId: exp.bullmqJobId,
    preflightWarnings: exp.preflightWarnings,
    retryCount: exp.retryCount,
    storageKey: exp.storageKey,
    contentType: exp.contentType,
    fileSizeBytes: exp.fileSizeBytes,
    errorMessage: exp.errorMessage,
    errorCode: exp.errorCode,
    processingStartedAt: exp.processingStartedAt,
    readyAt: exp.readyAt,
    createdAt: exp.createdAt,
    updatedAt: exp.updatedAt,
  };
}

const createDocxExportRoute = createRoute({
  method: "post",
  path: "/v1/documents/{documentId}/exports/docx",
  tags: ["exports"],
  summary: "Request async DOCX export for a document",
  request: {
    params: documentParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            idempotencyKey: z.string().min(1).max(255),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Export queued or replayed",
      content: {
        "application/json": {
          schema: z.object({
            export: ExportSchema,
            isReplay: z.boolean(),
            preflightWarnings: z.array(PreflightWarningSchema),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Document belongs to another workspace",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Document not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Conflict",
      content: { "application/json": { schema: ErrorSchema } },
    },
    429: {
      description: "Quota or concurrency limit",
      content: { "application/json": { schema: ErrorSchema } },
    },
    503: {
      description: "Queue unavailable",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const preflightDocxExportRoute = createRoute({
  method: "post",
  path: "/v1/documents/{documentId}/exports/docx/preflight",
  tags: ["exports"],
  summary: "Preflight DOCX export warnings without creating a job",
  request: {
    params: documentParamsSchema,
  },
  responses: {
    200: {
      description: "Preflight warnings",
      content: {
        "application/json": {
          schema: z.object({
            preflightWarnings: z.array(PreflightWarningSchema),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Document belongs to another workspace",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Document not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const listExportsRoute = createRoute({
  method: "get",
  path: "/v1/exports",
  tags: ["exports"],
  summary: "List recent exports for the current user",
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(50).default(20).optional(),
    }),
  },
  responses: {
    200: {
      description: "Export list",
      content: {
        "application/json": {
          schema: z.object({
            exports: z.array(ExportSchema),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const getExportRoute = createRoute({
  method: "get",
  path: "/v1/exports/{exportId}",
  tags: ["exports"],
  summary: "Get export status by id",
  request: {
    params: z.object({ exportId: z.string() }),
  },
  responses: {
    200: {
      description: "Export detail",
      content: {
        "application/json": {
          schema: z.object({ export: ExportSchema }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const retryExportRoute = createRoute({
  method: "post",
  path: "/v1/exports/{exportId}/retry",
  tags: ["exports"],
  summary: "Retry a failed export",
  request: {
    params: z.object({ exportId: z.string() }),
  },
  responses: {
    200: {
      description: "Export re-queued",
      content: {
        "application/json": {
          schema: z.object({ export: ExportSchema }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Not in failed state",
      content: { "application/json": { schema: ErrorSchema } },
    },
    429: {
      description: "Quota or concurrency limit",
      content: { "application/json": { schema: ErrorSchema } },
    },
    503: {
      description: "Queue unavailable",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const downloadExportRoute = createRoute({
  method: "get",
  path: "/v1/exports/{exportId}/download",
  tags: ["exports"],
  summary: "Download completed DOCX export",
  request: {
    params: z.object({ exportId: z.string() }),
  },
  responses: {
    200: {
      description: "DOCX file",
      content: {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          {
            schema: z.any(),
          },
      },
    },
    302: {
      description: "Redirect to presigned URL for download",
      headers: z.object({
        Location: z.string().openapi({ description: "Presigned URL" }),
      }),
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Not found or not ready",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

export function registerExportRoutes(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(preflightDocxExportRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const documentId = c.req.param("documentId");
    if (!documentId) {
      return c.json(
        createErrorPayload("bad_request", "Missing documentId", getRequestId(c)),
        400,
      );
    }

    const result = await context.services.exports.preflightDocxExport({
      userId: auth.bootstrap.user.id,
      workspaceId: auth.bootstrap.workspace.id,
      documentId,
    });

    if (result.type === "document_not_found") {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }

    if (result.type === "workspace_mismatch") {
      return c.json(
        createErrorPayload(
          "forbidden",
          "Document does not belong to workspace",
          getRequestId(c),
        ),
        403,
      );
    }

    return c.json({ preflightWarnings: result.warnings }, 200);
  }) as never);

  app.openapi(createDocxExportRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const documentId = c.req.param("documentId");
    if (!documentId) {
      return c.json(
        createErrorPayload(
          "bad_request",
          "Missing documentId",
          getRequestId(c),
        ),
        400,
      );
    }

    const body = (await c.req.json()) as { idempotencyKey: string };

    const result = await context.services.exports.requestDocxExport({
      userId: auth.bootstrap.user.id,
      workspaceId: auth.bootstrap.workspace.id,
      documentId,
      idempotencyKey: body.idempotencyKey,
    });

    if (result.type === "document_not_found") {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }

    if (result.type === "workspace_mismatch") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "workspace_mismatch",
        failureClass: "user",
        documentId,
      });
      return c.json(
        createErrorPayload(
          "forbidden",
          "Document does not belong to workspace",
          getRequestId(c),
        ),
        403,
      );
    }

    if (result.type === "quota_exceeded") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "export_quota_exceeded",
        failureClass: "user",
        documentId,
      });
      return c.json(
        createErrorPayload(
          "export_quota_exceeded",
          "Monthly export limit reached",
          getRequestId(c),
        ),
        429,
      );
    }

    if (result.type === "too_many_in_flight") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "export_in_flight_limit",
        failureClass: "user",
        documentId,
      });
      return c.json(
        createErrorPayload(
          "export_in_flight_limit",
          "Too many exports in progress",
          getRequestId(c),
        ),
        429,
      );
    }

    if (result.type === "queue_unavailable") {
      const message = "Export queue is temporarily unavailable";
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "queue_unavailable",
        failureClass: "system",
        documentId,
        message,
      });
      return c.json(
        createErrorPayload("service_unavailable", message, getRequestId(c)),
        503,
      );
    }

    const preflightWarnings =
      result.export.preflightWarnings ??
      ([] as NonNullable<typeof result.export.preflightWarnings>);

    logLaunchEvent("export.docx_requested", {
      userId: auth.bootstrap.user.id,
      documentId,
      exportId: result.export.id,
      isReplay: result.isReplay,
      preflightWarningCount: preflightWarnings.length,
    });

    return c.json(
      {
        export: exportToJson(result.export),
        isReplay: result.isReplay,
        preflightWarnings,
      },
      200,
    );
  }) as never);

  app.openapi(listExportsRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const limit = Number(c.req.query("limit") ?? 20);
    const safeLimit = Math.min(50, Math.max(1, limit));

    const exports = await context.services.exports.listExports({
      userId: auth.bootstrap.user.id,
      limit: safeLimit,
    });

    return c.json({ exports: exports.map(exportToJson) }, 200);
  }) as never);

  app.openapi(getExportRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const exportId = c.req.param("exportId");
    if (!exportId) {
      return c.json(
        createErrorPayload("bad_request", "Missing exportId", getRequestId(c)),
        400,
      );
    }

    const exp = await context.services.exports.getExport({
      userId: auth.bootstrap.user.id,
      exportId,
    });

    if (!exp) {
      return c.json(
        createErrorPayload("not_found", "Export not found", getRequestId(c)),
        404,
      );
    }

    return c.json({ export: exportToJson(exp) }, 200);
  }) as never);

  app.openapi(retryExportRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const exportId = c.req.param("exportId");
    if (!exportId) {
      return c.json(
        createErrorPayload("bad_request", "Missing exportId", getRequestId(c)),
        400,
      );
    }

    const result = await context.services.exports.retryExport({
      userId: auth.bootstrap.user.id,
      exportId,
    });

    if (result.type === "not_found") {
      return c.json(
        createErrorPayload("not_found", "Export not found", getRequestId(c)),
        404,
      );
    }

    if (result.type === "not_failed") {
      return c.json(
        createErrorPayload(
          "invalid_state",
          "Only failed exports can be retried",
          getRequestId(c),
        ),
        409,
      );
    }

    if (result.type === "quota_exceeded") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "export_quota_exceeded",
        failureClass: "user",
        exportId,
      });
      return c.json(
        createErrorPayload(
          "export_quota_exceeded",
          "Monthly export limit reached",
          getRequestId(c),
        ),
        429,
      );
    }

    if (result.type === "too_many_in_flight") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "export_in_flight_limit",
        failureClass: "user",
        exportId,
      });
      return c.json(
        createErrorPayload(
          "export_in_flight_limit",
          "Too many exports in progress",
          getRequestId(c),
        ),
        429,
      );
    }

    if (result.type === "queue_unavailable") {
      const message = "Export queue is temporarily unavailable";
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "queue_unavailable",
        failureClass: "system",
        exportId,
        message,
      });
      return c.json(
        createErrorPayload("service_unavailable", message, getRequestId(c)),
        503,
      );
    }

    if (result.type === "ok") {
      return c.json({ export: exportToJson(result.export) }, 200);
    }

    return c.json(
      createErrorPayload(
        "internal_error",
        "Unexpected retry result",
        getRequestId(c),
      ),
      500,
    );
  }) as never);

  app.openapi(downloadExportRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const exportId = c.req.param("exportId");
    if (!exportId) {
      return c.json(
        createErrorPayload("bad_request", "Missing exportId", getRequestId(c)),
        400,
      );
    }

    const exp = await context.services.exports.getExport({
      userId: auth.bootstrap.user.id,
      exportId,
    });

    if (!exp || exp.status !== "ready" || !exp.storageKey) {
      return c.json(
        createErrorPayload(
          "not_found",
          "Export not ready or file missing",
          getRequestId(c),
        ),
        404,
      );
    }

    const filename = `export-${exportId}.docx`;

    if (isR2ObjectStorageConfigured()) {
      try {
        const url = await presignGetExportObject({
          key: exp.storageKey,
          filename,
        });
        return c.redirect(url, 302);
      } catch (err) {
        logApiErrorEvent({
          path: c.req.path,
          requestId: getRequestId(c),
          code: "export_file_presign_failed",
          failureClass: "system",
          exportId,
        });
        return c.json(
          createErrorPayload(
            "not_found",
            "Export file could not be read",
            getRequestId(c),
          ),
          404,
        );
      }
    }

    try {
      const buffer = await readExportFile(exp.storageKey);
      c.header(
        "Content-Type",
        exp.contentType ??
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      return c.body(new Uint8Array(buffer), 200);
    } catch {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "export_file_read_failed",
        failureClass: "system",
        exportId,
      });
      return c.json(
        createErrorPayload(
          "not_found",
          "Export file could not be read",
          getRequestId(c),
        ),
        404,
      );
    }
  }) as never);
}
