import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { OutlineDraft } from "@aqshara/documents";
import { ErrorSchema } from "../openapi/schemas/common.js";
import {
  DocumentAstSchema,
  DocumentSchema,
  documentParamsSchema,
  OutlineDraftSchema,
  ProposalSchema,
} from "../openapi/schemas/documents.js";
import type { ApiEnv } from "../hono-env.js";
import type { DocumentStatus, DocumentType } from "../lib/app-context.js";
import {
  createErrorPayload,
  getDocumentId,
  getRequestId,
  requireAppUser,
} from "../http/api-http.js";
import { logApiErrorEvent } from "../lib/error-events.js";

const listDocumentsRoute = createRoute({
  method: "get",
  path: "/v1/documents",
  tags: ["documents"],
  summary: "List documents for the current user",
  request: {
    query: z.object({
      status: z.enum(["active", "archived"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Document list",
      content: {
        "application/json": {
          schema: z.object({
            documents: z.array(DocumentSchema),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const listRecentDocumentsRoute = createRoute({
  method: "get",
  path: "/v1/documents/recent",
  tags: ["documents"],
  summary: "List recent documents for the current user",
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(10).default(5).optional(),
    }),
  },
  responses: {
    200: {
      description: "Recent document list",
      content: {
        "application/json": {
          schema: z.object({
            documents: z.array(DocumentSchema),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const createDocumentRoute = createRoute({
  method: "post",
  path: "/v1/documents",
  tags: ["documents"],
  summary: "Create a new document",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: z.string().min(1),
            type: z.enum(["general_paper", "proposal", "skripsi"]),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created document",
      content: {
        "application/json": {
          schema: z.object({
            document: DocumentSchema,
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const getDocumentRoute = createRoute({
  method: "get",
  path: "/v1/documents/{documentId}",
  tags: ["documents"],
  summary: "Fetch a document by id",
  request: {
    params: documentParamsSchema,
  },
  responses: {
    200: {
      description: "Document detail",
      content: {
        "application/json": {
          schema: z.object({
            document: DocumentSchema,
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const patchDocumentRoute = createRoute({
  method: "patch",
  path: "/v1/documents/{documentId}",
  tags: ["documents"],
  summary: "Update document metadata",
  request: {
    params: documentParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: z.string().min(1).optional(),
            type: z.enum(["general_paper", "proposal", "skripsi"]).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated document",
      content: {
        "application/json": {
          schema: z.object({
            document: DocumentSchema,
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const saveDocumentRoute = createRoute({
  method: "put",
  path: "/v1/documents/{documentId}/content",
  tags: ["documents"],
  summary: "Save document content",
  request: {
    params: documentParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            contentJson: DocumentAstSchema,
            baseUpdatedAt: z.string().datetime(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Saved document",
      content: {
        "application/json": {
          schema: z.object({
            document: DocumentSchema,
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    409: {
      description: "Stale document save",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const archiveDocumentRoute = createRoute({
  method: "post",
  path: "/v1/documents/{documentId}/archive",
  tags: ["documents"],
  summary: "Archive a document",
  request: {
    params: documentParamsSchema,
  },
  responses: {
    200: {
      description: "Archived document",
      content: {
        "application/json": {
          schema: z.object({
            document: DocumentSchema,
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const deleteDocumentRoute = createRoute({
  method: "delete",
  path: "/v1/documents/{documentId}",
  tags: ["documents"],
  summary: "Delete a document",
  request: {
    params: documentParamsSchema,
  },
  responses: {
    204: {
      description: "Deleted",
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const getTemplatesRoute = createRoute({
  method: "get",
  path: "/v1/templates",
  tags: ["templates"],
  summary: "List available document templates",
  responses: {
    200: {
      description: "Available templates",
      content: {
        "application/json": {
          schema: z.object({ templates: z.array(z.string()) }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const bootstrapDocumentRoute = createRoute({
  method: "post",
  path: "/v1/documents/bootstrap",
  tags: ["documents"],
  summary: "Create a new document from a template or blank",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: z.string().min(1),
            type: z.enum(["general_paper", "proposal", "skripsi"]),
            templateCode: z.enum([
              "blank",
              "general_paper",
              "proposal",
              "skripsi",
            ]),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created document",
      content: {
        "application/json": { schema: z.object({ document: DocumentSchema }) },
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
  },
});

const generateOutlineRoute = createRoute({
  method: "post",
  path: "/v1/documents/{documentId}/outline/generate",
  tags: ["documents"],
  summary: "Generate an outline draft",
  request: {
    params: documentParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            topic: z.string().min(1),
            idempotencyKey: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Generated outline",
      content: {
        "application/json": {
          schema: z.object({
            outline: OutlineDraftSchema,
            usage: z.object({}),
          }),
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
      description: "Quota exceeded",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const applyOutlineRoute = createRoute({
  method: "post",
  path: "/v1/documents/{documentId}/outline/apply",
  tags: ["documents"],
  summary: "Apply an outline draft",
  request: {
    params: documentParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            outline: OutlineDraftSchema,
            baseUpdatedAt: z.string().datetime(),
            templateCode: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Applied outline",
      content: {
        "application/json": {
          schema: z.object({ document: DocumentSchema }),
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
      description: "Stale document",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const generateProposalRoute = createRoute({
  method: "post",
  path: "/v1/documents/{documentId}/ai/proposals",
  tags: ["documents"],
  summary: "Generate a writing proposal",
  request: {
    params: documentParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            action: z.enum([
              "continue",
              "rewrite",
              "paraphrase",
              "expand",
              "simplify",
            ]),
            targetBlockIds: z.array(z.string()),
            idempotencyKey: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Generated proposal",
      content: {
        "application/json": {
          schema: z.object({
            proposal: ProposalSchema,
            allowedApplyModes: z.array(z.string()),
          }),
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
      description: "Quota exceeded or duplicate",
      content: { "application/json": { schema: ErrorSchema } },
    },
    400: {
      description: "Bad request",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

export function registerDocumentRoutes(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(listDocumentsRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const status = (c.req.query("status") ?? "active") as DocumentStatus;
    const documents = await context.services.documents.listDocuments(
      result.bootstrap.user.id,
      status,
    );
    return c.json({ documents });
  }) as never);

  app.openapi(listRecentDocumentsRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const limitStr = c.req.query("limit");
    let limit = 5;
    if (limitStr) {
      const parsed = parseInt(limitStr, 10);
      if (!isNaN(parsed)) {
        limit = Math.max(1, Math.min(10, parsed));
      }
    }

    const documents = await context.services.documents.listRecentDocuments(
      result.bootstrap.user.id,
      limit,
    );
    return c.json({ documents });
  }) as never);

  app.openapi(createDocumentRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const body = (await c.req.json()) as {
      title: string;
      type: DocumentType;
    };
    const document = await context.services.documents.createDocument({
      userId: result.bootstrap.user.id,
      title: body.title,
      type: body.type,
    });
    return c.json({ document }, 201);
  }) as never);

  app.openapi(getDocumentRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const document = await context.services.documents.getDocument(
      result.bootstrap.user.id,
      getDocumentId(c),
    );
    if (!document) {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }
    return c.json({ document });
  }) as never);

  app.openapi(patchDocumentRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const body = (await c.req.json()) as {
      title?: string;
      type?: DocumentType;
    };
    const document = await context.services.documents.updateDocument(
      result.bootstrap.user.id,
      getDocumentId(c),
      body,
    );
    if (!document) {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }
    return c.json({ document });
  }) as never);

  app.openapi(saveDocumentRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const body = (await c.req.json()) as {
      contentJson: z.infer<typeof DocumentAstSchema>;
      baseUpdatedAt: string;
    };
    const saveResult = await context.services.documents.saveDocumentContent({
      userId: result.bootstrap.user.id,
      documentId: getDocumentId(c),
      contentJson: body.contentJson,
      baseUpdatedAt: body.baseUpdatedAt,
    });

    if (saveResult.ok === false) {
      if (saveResult.error === "not_found") {
        return c.json(
          createErrorPayload(
            "not_found",
            "Document not found",
            getRequestId(c),
          ),
          404,
        );
      }
      logApiErrorEvent({
        path: c.req.path,
        requestId: getRequestId(c),
        code: "stale_document_save",
        failureClass: "user",
        documentId: getDocumentId(c),
      });
      return c.json(
        createErrorPayload(
          "stale_document_save",
          "Stale document save",
          getRequestId(c),
        ),
        409,
      );
    }
    return c.json({ document: saveResult.document });
  }) as never);

  app.openapi(archiveDocumentRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const document = await context.services.documents.archiveDocument(
      result.bootstrap.user.id,
      getDocumentId(c),
    );
    if (!document) {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }
    return c.json({ document });
  }) as never);

  app.openapi(deleteDocumentRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const deleted = await context.services.documents.deleteDocument(
      result.bootstrap.user.id,
      getDocumentId(c),
    );
    if (!deleted) {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }
    return c.body(null, 204);
  }) as never);

  app.openapi(getTemplatesRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;
    return c.json({
      templates: context.services.documents.listTemplates(),
    });
  }) as never);

  app.openapi(bootstrapDocumentRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;
    const body = (await c.req.json()) as {
      title: string;
      type: DocumentType;
      templateCode: "blank" | "general_paper" | "proposal" | "skripsi";
    };

    const updatedDocument = await context.services.documents.bootstrapFromTemplate(
      {
        userId: result.bootstrap.user.id,
        title: body.title,
        type: body.type,
        templateCode: body.templateCode,
      },
    );
    return c.json({ document: updatedDocument }, 201);
  }) as never);

  app.openapi(generateOutlineRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;
    const documentId = getDocumentId(c);
    const body = (await c.req.json()) as {
      topic: string;
      idempotencyKey: string;
    };

    const outlineResult = await context.services.writing.generateOutline({
      userId: result.bootstrap.user.id,
      documentId,
      topic: body.topic,
      idempotencyKey: body.idempotencyKey,
    });

    if (outlineResult.type === "not_found") {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }
    if (outlineResult.type === "quota_exceeded") {
      return c.json(
        createErrorPayload(
          "quota_exceeded",
          "AI action quota exceeded",
          getRequestId(c),
        ),
        409,
      );
    }
    if (outlineResult.type === "duplicate_request") {
      return c.json(
        createErrorPayload(
          "duplicate_request",
          "Reused idempotency key",
          getRequestId(c),
        ),
        409,
      );
    }
    if (outlineResult.type === "replay") {
      return c.json({
        outline: outlineResult.outline as OutlineDraft,
        usage: outlineResult.usage,
      });
    }
    return c.json({
      outline: outlineResult.outline,
      usage: outlineResult.usage,
    });
  }) as never);

  app.openapi(applyOutlineRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;
    const documentId = getDocumentId(c);
    const body = (await c.req.json()) as {
      outline: OutlineDraft;
      baseUpdatedAt: string;
      templateCode?: string;
    };

    const applyResult = await context.services.documents.applyOutline({
      userId: result.bootstrap.user.id,
      documentId,
      outline: body.outline,
      baseUpdatedAt: body.baseUpdatedAt,
    });
    if (applyResult.ok === false) {
      if (applyResult.error === "not_found") {
        return c.json(
          createErrorPayload(
            "not_found",
            "Document not found",
            getRequestId(c),
          ),
          404,
        );
      }
      return c.json(
        createErrorPayload(
          "stale_outline_apply",
          "Stale outline apply",
          getRequestId(c),
        ),
        409,
      );
    }
    return c.json({ document: applyResult.document });
  }) as never);

  app.openapi(generateProposalRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;
    const documentId = getDocumentId(c);
    const body = (await c.req.json()) as {
      action: "continue" | "rewrite" | "paraphrase" | "expand" | "simplify";
      targetBlockIds: string[];
      idempotencyKey: string;
    };

    const genResult = await context.services.writing.generateProposal(
      result.bootstrap.user.id,
      documentId,
      body,
    );

    if (genResult.type === "invalid_target") {
      return c.json(
        createErrorPayload("invalid_target", genResult.message, getRequestId(c)),
        400,
      );
    }
    if (genResult.type === "not_found") {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }
    if (genResult.type === "quota_exceeded") {
      return c.json(
        createErrorPayload(
          "quota_exceeded",
          "AI action quota exceeded",
          getRequestId(c),
        ),
        409,
      );
    }
    if (genResult.type === "duplicate_request") {
      return c.json(
        createErrorPayload(
          "duplicate_request",
          genResult.message,
          getRequestId(c),
        ),
        409,
      );
    }
    return c.json({
      proposal: genResult.proposal,
      allowedApplyModes: genResult.allowedApplyModes,
    });
  }) as never);
}
