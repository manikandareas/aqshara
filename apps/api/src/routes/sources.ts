import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { ErrorSchema } from "../openapi/schemas/common.js";
import { documentParamsSchema } from "../openapi/schemas/documents.js";
import { SourceSchema, sourceParamsSchema } from "../openapi/schemas/sources.js";
import type { ApiEnv } from "../hono-env.js";
import type { AppSource } from "../repositories/app-repository.types.js";
import {
  createErrorPayload,
  getRequestId,
  requireAppUser,
} from "../http/api-http.js";
import { logApiErrorEvent } from "../lib/error-events.js";

function sourceToJson(s: AppSource) {
  return {
    id: s.id,
    status: s.status,
    mimeType: s.mimeType,
    originalFileName: s.originalFileName,
    fileSizeBytes: s.fileSizeBytes,
    pageCount: s.pageCount,
    retryCount: s.retryCount,
    errorMessage: s.errorMessage,
    errorCode: s.errorCode,
    processingStartedAt: s.processingStartedAt,
    readyAt: s.readyAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

const uploadUrlRoute = createRoute({
  method: "post",
  path: "/v1/sources/upload-url",
  tags: ["sources"],
  summary: "Create a presigned upload target for a PDF source",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({}),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned PUT target",
      content: {
        "application/json": {
          schema: z.object({
            sourceId: z.string(),
            storageKey: z.string(),
            uploadUrl: z.string(),
            expiresInSeconds: z.number(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Workspace mismatch",
      content: { "application/json": { schema: ErrorSchema } },
    },
    503: {
      description: "Object storage unavailable",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const registerSourceRoute = createRoute({
  method: "post",
  path: "/v1/sources/register",
  tags: ["sources"],
  summary: "Register uploaded PDF and enqueue parse job",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            documentId: z.string().uuid(),
            sourceId: z.string().uuid(),
            storageKey: z.string().min(1),
            originalFileName: z.string().min(1).max(512),
            fileSizeBytes: z.number().int().positive(),
            checksum: z.string().min(8).max(128),
            mimeType: z.string().min(1).max(128),
            idempotencyKey: z.string().min(1).max(255).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Source registered",
      content: {
        "application/json": {
          schema: z.object({
            source: SourceSchema,
            isReplay: z.boolean(),
            relinked: z.boolean(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Forbidden",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Conflict",
      content: { "application/json": { schema: ErrorSchema } },
    },
    429: {
      description: "Quota",
      content: { "application/json": { schema: ErrorSchema } },
    },
    503: {
      description: "Queue unavailable",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const listDocumentSourcesRoute = createRoute({
  method: "get",
  path: "/v1/documents/{documentId}/sources",
  tags: ["sources"],
  summary: "List sources linked to a document",
  request: {
    params: documentParamsSchema,
  },
  responses: {
    200: {
      description: "Sources for document",
      content: {
        "application/json": {
          schema: z.object({ sources: z.array(SourceSchema) }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Document not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const sourceStatusRoute = createRoute({
  method: "get",
  path: "/v1/sources/{sourceId}/status",
  tags: ["sources"],
  summary: "Get source lifecycle status",
  request: {
    params: sourceParamsSchema,
  },
  responses: {
    200: {
      description: "Source status",
      content: {
        "application/json": {
          schema: z.object({ source: SourceSchema }),
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

const retrySourceRoute = createRoute({
  method: "post",
  path: "/v1/sources/{sourceId}/retry",
  tags: ["sources"],
  summary: "Retry a failed source parse",
  request: {
    params: sourceParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            forceOcr: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Parse re-queued",
      content: {
        "application/json": {
          schema: z.object({ source: SourceSchema }),
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
      description: "Invalid state",
      content: { "application/json": { schema: ErrorSchema } },
    },
    429: {
      description: "Quota",
      content: { "application/json": { schema: ErrorSchema } },
    },
    503: {
      description: "Queue unavailable",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const deleteSourceRoute = createRoute({
  method: "delete",
  path: "/v1/sources/{sourceId}",
  tags: ["sources"],
  summary: "Soft-delete a source and remove storage objects",
  request: {
    params: sourceParamsSchema,
  },
  responses: {
    204: {
      description: "Deleted",
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
      description: "Already deleted",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

export function registerSourceRoutes(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(uploadUrlRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const result = await context.services.sources.createUploadUrl({
      userId: auth.bootstrap.user.id,
      workspaceId: auth.bootstrap.workspace.id,
    });

    if (result.type === "workspace_mismatch") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "workspace_mismatch",
        failureClass: "user",
        userId: auth.bootstrap.user.id,
      });
      return c.json(
        createErrorPayload(
          "forbidden",
          "Workspace mismatch",
          getRequestId(c),
        ),
        403,
      );
    }

    if (result.type === "storage_not_configured") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "storage_not_configured",
        failureClass: "system",
        message: "R2 object storage is not configured",
      });
      return c.json(
        createErrorPayload(
          "service_unavailable",
          "Object storage is not configured",
          getRequestId(c),
        ),
        503,
      );
    }

    return c.json(
      {
        sourceId: result.sourceId,
        storageKey: result.storageKey,
        uploadUrl: result.uploadUrl,
        expiresInSeconds: result.expiresInSeconds,
      },
      200,
    );
  }) as never);

  app.openapi(registerSourceRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const body = (await c.req.json()) as {
      documentId: string;
      sourceId: string;
      storageKey: string;
      originalFileName: string;
      fileSizeBytes: number;
      checksum: string;
      mimeType: string;
      idempotencyKey?: string;
    };

    const result = await context.services.sources.registerSource({
      userId: auth.bootstrap.user.id,
      workspaceId: auth.bootstrap.workspace.id,
      documentId: body.documentId,
      sourceId: body.sourceId,
      storageKey: body.storageKey,
      originalFileName: body.originalFileName,
      fileSizeBytes: body.fileSizeBytes,
      checksum: body.checksum,
      mimeType: body.mimeType,
      idempotencyKey: body.idempotencyKey ?? null,
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
        documentId: body.documentId,
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

    if (result.type === "object_missing" || result.type === "object_invalid") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: result.type,
        failureClass: "user",
        documentId: body.documentId,
        sourceId: body.sourceId,
        message: result.message,
      });
      return c.json(
        createErrorPayload(
          "bad_request",
          result.message ?? "Invalid upload object",
          getRequestId(c),
        ),
        400,
      );
    }

    if (result.type === "invalid_pdf" || result.type === "limits_exceeded") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: result.type,
        failureClass: "user",
        documentId: body.documentId,
        message: result.message,
      });
      return c.json(
        createErrorPayload(
          "bad_request",
          result.message ?? "Invalid request",
          getRequestId(c),
        ),
        400,
      );
    }

    if (result.type === "idempotency_mismatch") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "idempotency_mismatch",
        failureClass: "user",
      });
      return c.json(
        createErrorPayload(
          "conflict",
          "Idempotency key does not match source id",
          getRequestId(c),
        ),
        409,
      );
    }

    if (result.type === "quota_exceeded") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "source_quota_exceeded",
        failureClass: "user",
      });
      return c.json(
        createErrorPayload(
          "source_quota_exceeded",
          "Monthly source parse limit reached",
          getRequestId(c),
        ),
        429,
      );
    }

    if (result.type === "too_many_in_flight") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "source_in_flight_limit",
        failureClass: "user",
      });
      return c.json(
        createErrorPayload(
          "source_in_flight_limit",
          "Too many sources in progress",
          getRequestId(c),
        ),
        429,
      );
    }

    if (result.type === "queue_unavailable") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "queue_unavailable",
        failureClass: "system",
        message: result.message,
      });
      return c.json(
        createErrorPayload(
          "service_unavailable",
          result.message ?? "Queue unavailable",
          getRequestId(c),
        ),
        503,
      );
    }

    if (result.type === "storage_unavailable") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "storage_unavailable",
        failureClass: "system",
        message: result.message,
      });
      return c.json(
        createErrorPayload(
          "service_unavailable",
          result.message ?? "Storage unavailable",
          getRequestId(c),
        ),
        503,
      );
    }

    if (result.type === "ok") {
      return c.json(
        {
          source: sourceToJson(result.source),
          isReplay: result.isReplay,
          relinked: result.relinked,
        },
        200,
      );
    }

    return c.json(
      createErrorPayload(
        "internal_error",
        "Unexpected source registration outcome",
        getRequestId(c),
      ),
      500,
    );
  }) as never);

  app.openapi(listDocumentSourcesRoute, (async (c: Context<ApiEnv>) => {
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

    const doc = await context.repository.getDocumentById({
      userId: auth.bootstrap.user.id,
      documentId,
    });

    if (!doc) {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }

    const sources = await context.services.sources.listForDocument({
      userId: auth.bootstrap.user.id,
      documentId,
    });

    return c.json(
      { sources: sources.map(sourceToJson) },
      200,
    );
  }) as never);

  app.openapi(sourceStatusRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const sourceId = c.req.param("sourceId");
    if (!sourceId) {
      return c.json(
        createErrorPayload("bad_request", "Missing sourceId", getRequestId(c)),
        400,
      );
    }

    const source = await context.services.sources.getStatus({
      userId: auth.bootstrap.user.id,
      sourceId,
    });

    if (!source) {
      return c.json(
        createErrorPayload("not_found", "Source not found", getRequestId(c)),
        404,
      );
    }

    return c.json({ source: sourceToJson(source) }, 200);
  }) as never);

  app.openapi(retrySourceRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const sourceId = c.req.param("sourceId");
    if (!sourceId) {
      return c.json(
        createErrorPayload("bad_request", "Missing sourceId", getRequestId(c)),
        400,
      );
    }

    const body = (await c.req.json().catch(() => ({}))) as {
      forceOcr?: boolean;
    };

    const result = await context.services.sources.retry({
      userId: auth.bootstrap.user.id,
      sourceId,
      forceOcr: body.forceOcr ?? false,
    });

    if (result.type === "not_found") {
      return c.json(
        createErrorPayload("not_found", "Source not found", getRequestId(c)),
        404,
      );
    }

    if (result.type === "not_failed") {
      return c.json(
        createErrorPayload(
          "conflict",
          "Source is not in a failed state",
          getRequestId(c),
        ),
        409,
      );
    }

    if (result.type === "quota_exceeded") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "source_quota_exceeded",
        failureClass: "user",
        sourceId,
      });
      return c.json(
        createErrorPayload(
          "source_quota_exceeded",
          "Monthly source parse limit reached",
          getRequestId(c),
        ),
        429,
      );
    }

    if (result.type === "too_many_in_flight") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "source_in_flight_limit",
        failureClass: "user",
        sourceId,
      });
      return c.json(
        createErrorPayload(
          "source_in_flight_limit",
          "Too many sources in progress",
          getRequestId(c),
        ),
        429,
      );
    }

    if (result.type === "queue_unavailable") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "queue_unavailable",
        failureClass: "system",
        sourceId,
        message: result.message,
      });
      return c.json(
        createErrorPayload(
          "service_unavailable",
          result.message ?? "Queue unavailable",
          getRequestId(c),
        ),
        503,
      );
    }

    if (result.type === "ok") {
      return c.json({ source: sourceToJson(result.source) }, 200);
    }

    return c.json(
      createErrorPayload(
        "internal_error",
        "Unexpected source retry outcome",
        getRequestId(c),
      ),
      500,
    );
  }) as never);

  app.openapi(deleteSourceRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const auth = await requireAppUser(c);
    if (auth.error) return auth.error;

    const sourceId = c.req.param("sourceId");
    if (!sourceId) {
      return c.json(
        createErrorPayload("bad_request", "Missing sourceId", getRequestId(c)),
        400,
      );
    }

    const result = await context.services.sources.delete({
      userId: auth.bootstrap.user.id,
      sourceId,
    });

    if (result.type === "not_found") {
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "source_not_found",
        failureClass: "user",
        sourceId,
      });
      return c.json(
        createErrorPayload("not_found", "Source not found", getRequestId(c)),
        404,
      );
    }

    if (result.type === "already_deleted") {
      return c.json(
        createErrorPayload(
          "conflict",
          "Source was already deleted",
          getRequestId(c),
        ),
        409,
      );
    }

    return c.body(null, 204);
  }) as never);
}
