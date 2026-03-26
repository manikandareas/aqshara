import {
  applyDocumentChangeProposal,
  createTemplateDocument,
  outlineDraftToDocumentValue,
  toPlainText,
} from "@aqshara/documents";
import type { WebhookEvent } from "@clerk/backend/webhooks";
import { Scalar } from "@scalar/hono-api-reference";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import type { OutlineDraft } from "@aqshara/documents";
import { swaggerUI } from "@hono/swagger-ui";

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiInfo } from "@aqshara/api-spec";
import { getApiBaseUrl } from "@aqshara/config";
import type { Context } from "hono";
import {
  type AppContext,
  type DocumentStatus,
  type DocumentType,
  StaleDocumentSaveError,
  toProvisioningIdentity,
} from "./lib/app-context.js";

const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.literal("api"),
  timestamp: z.string(),
});

const AppUserSchema = z.object({
  id: z.string(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  planCode: z.literal("free"),
});

const WorkspaceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
});

const UsageSchema = z.object({
  period: z.string(),
  aiActionsUsed: z.number(),
  aiActionsReserved: z.number(),
  aiActionsRemaining: z.number(),
  exportsRemaining: z.number(),
  sourceUploadsRemaining: z.number(),
});

const PlanSummarySchema = z.object({
  code: z.literal("free"),
  label: z.literal("Free"),
});

const TTextSchema = z.object({ text: z.string() });
const DocumentNodeSchema = z.union([
  z.object({
    type: z.literal("heading"),
    id: z.string(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    children: z.array(TTextSchema),
  }),
  z.object({
    type: z.literal("paragraph"),
    id: z.string(),
    children: z.array(TTextSchema),
  }),
  z.object({
    type: z.literal("bullet-list"),
    id: z.string(),
    children: z.array(
      z.object({
        type: z.literal("list-item"),
        id: z.string(),
        children: z.array(TTextSchema),
      }),
    ),
  }),
]);

const DocumentAstSchema = z.array(DocumentNodeSchema);

const DocumentSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  type: z.enum(["general_paper", "proposal", "skripsi"]),
  contentJson: DocumentAstSchema,
  plainText: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["system"],
  summary: "Health check",
  responses: {
    200: {
      description: "Healthy API",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

const webhookRoute = createRoute({
  method: "post",
  path: "/webhooks/clerk",
  tags: ["webhooks"],
  summary: "Handle Clerk user sync webhooks",
  responses: {
    200: {
      description: "Webhook accepted",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
          }),
        },
      },
    },
    400: {
      description: "Invalid webhook",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const meRoute = createRoute({
  method: "get",
  path: "/v1/me",
  tags: ["auth"],
  summary: "Read the current provisioned app session",
  responses: {
    200: {
      description: "Current app session",
      content: {
        "application/json": {
          schema: z.object({
            user: AppUserSchema,
            workspace: WorkspaceSchema,
            plan: PlanSummarySchema,
            usage: UsageSchema,
            documentStats: z.object({
              activeCount: z.number(),
              archivedCount: z.number(),
            }),
            onboarding: z.object({
              shouldShow: z.boolean(),
              reason: z.enum(["zero_documents", "has_documents"]),
            }),
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
    403: {
      description: "Account deleted",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    409: {
      description: "Account provisioning pending",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

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

const documentParamsSchema = z.object({
  documentId: z.string(),
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

function createErrorPayload(code: string, message: string, requestId: string) {
  return {
    code,
    message,
    requestId,
  };
}

function getDocumentId(c: Context) {
  const documentId = c.req.param("documentId");

  if (!documentId) {
    throw new Error("Document id is required");
  }

  return documentId;
}

function getRequestId(c: {
  req: { header: (name: string) => string | undefined };
}) {
  return c.req.header("x-request-id") ?? "local";
}

async function requireAppUser(
  context: AppContext,
  c: {
    req: { header: (name: string) => string | undefined };
    json: (payload: unknown, status: number) => Response;
  },
) {
  const clerkUserId = await context.getAuthenticatedClerkUserId(c as never);

  if (!clerkUserId) {
    return {
      error: c.json(
        createErrorPayload(
          "unauthorized",
          "Authentication required",
          getRequestId(c),
        ),
        401,
      ),
    };
  }

  const user = await context.repository.getUserByClerkUserId(clerkUserId);

  if (!user) {
    return {
      error: c.json(
        createErrorPayload(
          "account_provisioning",
          "Account provisioning is still pending",
          getRequestId(c),
        ),
        409,
      ),
    };
  }

  if (user.deletedAt) {
    return {
      error: c.json(
        createErrorPayload(
          "account_deleted",
          "Account access has been removed",
          getRequestId(c),
        ),
        403,
      ),
    };
  }

  const workspace = await context.repository.getWorkspaceForUser(user.id);

  if (!workspace) {
    return {
      error: c.json(
        createErrorPayload(
          "account_provisioning",
          "Account provisioning is still pending",
          getRequestId(c),
        ),
        409,
      ),
    };
  }

  return {
    bootstrap: {
      user,
      workspace,
    },
  };
}

const OutlineDraftNodeSchema = z.union([
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string(),
  }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("bullet_list"), items: z.array(z.string()) }),
]);

const OutlineDraftSchema = z.object({
  title: z.string(),
  nodes: z.array(OutlineDraftNodeSchema),
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
        "application/json": { schema: z.object({ document: DocumentSchema }) },
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

const DocumentChangeProposalSchema = z.object({
  id: z.string(),
  targetBlockIds: z.array(z.string()),
  action: z.enum(["replace", "insert_below"]),
  nodes: z.array(DocumentNodeSchema),
});

const ProposalSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  userId: z.string(),
  proposalJson: DocumentChangeProposalSchema,
  actionType: z.enum(["replace", "insert_below"]),
  status: z.enum([
    "pending",
    "applied",
    "dismissed",
    "invalidated",
    "previewed",
  ]),
  baseUpdatedAt: z.string(),
  targetBlockIds: z.array(z.string()),
  appliedAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
  invalidatedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
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

const applyProposalRoute = createRoute({
  method: "post",
  path: "/v1/ai/proposals/{proposalId}/apply",
  tags: ["proposals"],
  summary: "Apply a document change proposal",
  request: {
    params: z.object({ proposalId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            baseUpdatedAt: z.string().datetime(),
            mode: z.enum(["replace", "insert_below"]),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Applied proposal",
      content: {
        "application/json": {
          schema: z.object({
            document: DocumentSchema,
            proposal: ProposalSchema,
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
      description: "Conflict",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const dismissProposalRoute = createRoute({
  method: "post",
  path: "/v1/ai/proposals/{proposalId}/dismiss",
  tags: ["proposals"],
  summary: "Dismiss a document change proposal",
  request: {
    params: z.object({ proposalId: z.string() }),
  },
  responses: {
    200: {
      description: "Dismissed proposal",
      content: {
        "application/json": {
          schema: z.object({
            proposal: ProposalSchema,
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
  },
});

export function createApp(context: AppContext) {
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    context.logger.info(`${c.req.method} ${c.req.path}`);
    await next();
  });
  app.use("/v1/*", context.authMiddleware);

  app.openapi(healthRoute, (c) => {
    return c.json({
      ok: true,
      service: "api",
      timestamp: new Date().toISOString(),
    });
  });

  app.openapi(webhookRoute, (async (c: Context) => {
    let event: WebhookEvent;

    try {
      event = await context.verifyWebhook(c.req.raw);
    } catch (error) {
      context.logger.error("Webhook verification failed", error);
      return c.json(
        createErrorPayload(
          "invalid_webhook",
          "Webhook verification failed",
          getRequestId(c),
        ),
        400,
      );
    }

    if (event.type === "user.deleted") {
      if (event.data.id) {
        await context.repository.softDeleteUserByClerkUserId(event.data.id);
      }

      return c.json({ ok: true });
    }

    const identity =
      event.type === "user.created" || event.type === "user.updated"
        ? toProvisioningIdentity(event.data)
        : null;

    if (!identity) {
      return c.json({ ok: true });
    }

    const existingUser = await context.repository.getUserByClerkUserId(
      identity.clerkUserId,
    );

    if (existingUser?.deletedAt) {
      return c.json({ ok: true });
    }

    await context.repository.upsertUserFromWebhook(identity);
    return c.json({ ok: true });
  }) as never);

  app.openapi(meRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);

    if (result.error) {
      return result.error;
    }

    const [usage, activeCount, archivedCount] = await Promise.all([
      context.getUsage(result.bootstrap.user),
      context.repository.countActiveDocuments(result.bootstrap.user.id),
      context.repository.countArchivedDocuments(result.bootstrap.user.id),
    ]);

    const totalDocuments = activeCount + archivedCount;
    const hasDocuments = totalDocuments > 0;

    return c.json({
      user: result.bootstrap.user,
      workspace: result.bootstrap.workspace,
      plan: {
        code: result.bootstrap.user.planCode,
        label: "Free",
      },
      usage,
      documentStats: {
        activeCount,
        archivedCount,
      },
      onboarding: {
        shouldShow: !hasDocuments,
        reason: hasDocuments ? "has_documents" : "zero_documents",
      },
    });
  }) as never);

  app.openapi(listDocumentsRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);

    if (result.error) {
      return result.error;
    }

    const status = (c.req.query("status") ?? "active") as DocumentStatus;
    const documents = await context.repository.listDocuments({
      userId: result.bootstrap.user.id,
      status,
    });

    return c.json({
      documents,
    });
  }) as never);

  app.openapi(listRecentDocumentsRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);

    if (result.error) {
      return result.error;
    }

    const limitStr = c.req.query("limit");
    let limit = 5;
    if (limitStr) {
      const parsed = parseInt(limitStr, 10);
      if (!isNaN(parsed)) {
        limit = Math.max(1, Math.min(10, parsed));
      }
    }

    const documents = await context.repository.listRecentDocuments({
      userId: result.bootstrap.user.id,
      limit,
    });

    return c.json({
      documents,
    });
  }) as never);

  app.openapi(createDocumentRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);

    if (result.error) {
      return result.error;
    }

    const body = (await c.req.json()) as {
      title: string;
      type: DocumentType;
    };
    const document = await context.repository.createDocument({
      userId: result.bootstrap.user.id,
      title: body.title,
      type: body.type as DocumentType,
    });

    return c.json(
      {
        document,
      },
      201,
    );
  }) as never);

  app.openapi(getDocumentRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);

    if (result.error) {
      return result.error;
    }

    const document = await context.repository.getDocumentById({
      userId: result.bootstrap.user.id,
      documentId: getDocumentId(c),
    });

    if (!document) {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }

    return c.json({
      document,
    });
  }) as never);

  app.openapi(patchDocumentRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);

    if (result.error) {
      return result.error;
    }

    const body = (await c.req.json()) as {
      title?: string;
      type?: DocumentType;
    };
    const document = await context.repository.updateDocument({
      userId: result.bootstrap.user.id,
      documentId: getDocumentId(c),
      patch: body,
    });

    if (!document) {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }

    return c.json({
      document,
    });
  }) as never);

  app.openapi(saveDocumentRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);

    if (result.error) {
      return result.error;
    }

    const body = (await c.req.json()) as {
      contentJson: z.infer<typeof DocumentAstSchema>;
      baseUpdatedAt: string;
    };
    try {
      const document = await context.repository.updateDocumentContent({
        userId: result.bootstrap.user.id,
        documentId: getDocumentId(c),
        contentJson: body.contentJson,
        plainText: toPlainText(body.contentJson),
        baseUpdatedAt: body.baseUpdatedAt,
      });

      if (!document) {
        return c.json(
          createErrorPayload(
            "not_found",
            "Document not found",
            getRequestId(c),
          ),
          404,
        );
      }

      return c.json({
        document,
      });
    } catch (error) {
      if (error instanceof StaleDocumentSaveError) {
        return c.json(
          createErrorPayload(
            "stale_document_save",
            "Stale document save",
            getRequestId(c),
          ),
          409,
        );
      }
      throw error;
    }
  }) as never);

  app.openapi(archiveDocumentRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);

    if (result.error) {
      return result.error;
    }

    const document = await context.repository.archiveDocument({
      userId: result.bootstrap.user.id,
      documentId: getDocumentId(c),
    });

    if (!document) {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }

    return c.json({
      document,
    });
  }) as never);

  app.openapi(deleteDocumentRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);

    if (result.error) {
      return result.error;
    }

    const deleted = await context.repository.deleteDocument({
      userId: result.bootstrap.user.id,
      documentId: getDocumentId(c),
    });

    if (!deleted) {
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );
    }

    return c.body(null, 204);
  }) as never);

  app.openapi(getTemplatesRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);
    if (result.error) return result.error;
    return c.json({
      templates: ["blank", "general_paper", "proposal", "skripsi"],
    });
  }) as never);

  app.openapi(bootstrapDocumentRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);
    if (result.error) return result.error;
    const body = (await c.req.json()) as {
      title: string;
      type: DocumentType;
      templateCode: "blank" | "general_paper" | "proposal" | "skripsi";
    };

    const document = await context.repository.createDocument({
      userId: result.bootstrap.user.id,
      title: body.title,
      type: body.type,
    });

    const contentJson = createTemplateDocument(body.templateCode);
    const updatedDocument = await context.repository.updateDocumentContent({
      userId: result.bootstrap.user.id,
      documentId: document.id,
      contentJson,
      plainText: toPlainText(contentJson),
      baseUpdatedAt: document.updatedAt,
    });

    return c.json({ document: updatedDocument! }, 201);
  }) as never);

  app.openapi(generateOutlineRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);
    if (result.error) return result.error;
    const documentId = getDocumentId(c);
    const body = (await c.req.json()) as {
      topic: string;
      idempotencyKey: string;
    };

    const document = await context.repository.getDocumentById({
      userId: result.bootstrap.user.id,
      documentId,
    });
    if (!document)
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );

    try {
      const reservation = await context.repository.reserveAiAction({
        userId: result.bootstrap.user.id,
        featureKey: "outline",
        idempotencyKey: body.idempotencyKey,
        requestHash: body.topic,
      });

      if (!reservation.allowed) {
        if (reservation.reason === "quota_exceeded") {
          return c.json(
            createErrorPayload(
              "quota_exceeded",
              "AI action quota exceeded",
              getRequestId(c),
            ),
            409,
          );
        }
        if (reservation.reason === "idempotency_mismatch") {
          return c.json(
            createErrorPayload(
              "duplicate_request",
              "Reused idempotency key",
              getRequestId(c),
            ),
            409,
          );
        }
      }

      if (reservation.isReplay) {
        return c.json({
          outline: reservation.metadataJson as unknown as OutlineDraft,
          usage: {},
        });
      }

      const outline = await context.aiService.generateOutlineDraft({
        action: "outline",
        topic: body.topic,
      });

      await context.repository.finalizeAiAction(
        reservation.eventId!,
        outline as unknown as Record<string, unknown>,
      );
      return c.json({ outline, usage: {} });
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes("Quota exceeded")) {
        return c.json(
          createErrorPayload(
            "quota_exceeded",
            "AI action quota exceeded",
            getRequestId(c),
          ),
          409,
        );
      }
      throw error;
    }
  }) as never);

  app.openapi(applyOutlineRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);
    if (result.error) return result.error;
    const documentId = getDocumentId(c);
    const body = (await c.req.json()) as {
      outline: OutlineDraft;
      baseUpdatedAt: string;
      templateCode?: string;
    };

    const contentJson = outlineDraftToDocumentValue(body.outline);
    try {
      const document = await context.repository.updateDocumentContent({
        userId: result.bootstrap.user.id,
        documentId,
        contentJson,
        plainText: toPlainText(contentJson),
        baseUpdatedAt: body.baseUpdatedAt,
      });
      if (!document)
        return c.json(
          createErrorPayload(
            "not_found",
            "Document not found",
            getRequestId(c),
          ),
          404,
        );
      return c.json({ document });
    } catch (error) {
      if (error instanceof StaleDocumentSaveError) {
        return c.json(
          createErrorPayload(
            "stale_outline_apply",
            "Stale outline apply",
            getRequestId(c),
          ),
          409,
        );
      }
      throw error;
    }
  }) as never);

  app.openapi(generateProposalRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);
    if (result.error) return result.error;
    const documentId = getDocumentId(c);
    const body = (await c.req.json()) as {
      action: "continue" | "rewrite" | "paraphrase" | "expand" | "simplify";
      targetBlockIds: string[];
      idempotencyKey: string;
    };

    if (body.action === "continue" && body.targetBlockIds.length !== 1) {
      return c.json(
        createErrorPayload(
          "invalid_target",
          "Continue requires exactly 1 block",
          getRequestId(c),
        ),
        400,
      );
    }
    if (
      ["rewrite", "paraphrase", "expand", "simplify"].includes(body.action) &&
      body.targetBlockIds.length === 0
    ) {
      return c.json(
        createErrorPayload(
          "invalid_target",
          "Action requires at least 1 block",
          getRequestId(c),
        ),
        400,
      );
    }

    const document = await context.repository.getDocumentById({
      userId: result.bootstrap.user.id,
      documentId,
    });
    if (!document)
      return c.json(
        createErrorPayload("not_found", "Document not found", getRequestId(c)),
        404,
      );

    try {
      const reservation = await context.repository.reserveAiAction({
        userId: result.bootstrap.user.id,
        featureKey: "writing_proposal",
        idempotencyKey: body.idempotencyKey,
        requestHash: JSON.stringify({
          action: body.action,
          targetBlockIds: body.targetBlockIds,
        }),
      });

      if (!reservation.allowed) {
        if (reservation.reason === "quota_exceeded") {
          return c.json(
            createErrorPayload(
              "quota_exceeded",
              "AI action quota exceeded",
              getRequestId(c),
            ),
            409,
          );
        }
        if (reservation.reason === "idempotency_mismatch") {
          return c.json(
            createErrorPayload(
              "duplicate_request",
              "Reused idempotency key with different payload",
              getRequestId(c),
            ),
            409,
          );
        }
      }

      if (reservation.isReplay) {
        const metadata = reservation.metadataJson as { proposalId: string };
        const existing = await context.repository.getDocumentChangeProposal(
          metadata.proposalId,
        );
        return c.json({
          proposal: existing,
          allowedApplyModes: ["replace", "insert_below"],
        });
      }

      const targetBlocks = document.contentJson.filter((b: { id: string }) =>
        body.targetBlockIds.includes(b.id),
      );
      const text = toPlainText(
        targetBlocks as Parameters<typeof toPlainText>[0],
      );

      const nodes = await context.aiService.generateWritingProposal({
        action: body.action,
        text,
        context: document.title,
      });

      const proposal = await context.repository.createDocumentChangeProposal({
        documentId,
        userId: result.bootstrap.user.id,
        proposalJson: {
          id: crypto.randomUUID(),
          targetBlockIds: body.targetBlockIds,
          action: "replace",
          nodes,
        },
        actionType: "replace",
        baseUpdatedAt: document.updatedAt,
        targetBlockIds: body.targetBlockIds,
      });

      await context.repository.finalizeAiAction(reservation.eventId!, {
        proposalId: proposal.id,
      });

      return c.json({
        proposal,
        allowedApplyModes: ["replace", "insert_below"],
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes("Quota exceeded")) {
        return c.json(
          createErrorPayload(
            "quota_exceeded",
            "AI action quota exceeded",
            getRequestId(c),
          ),
          409,
        );
      }
      throw error;
    }
  }) as never);

  app.openapi(applyProposalRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);
    if (result.error) return result.error;

    const proposalId = c.req.param("proposalId")!;
    if (!proposalId)
      return c.json(
        createErrorPayload(
          "bad_request",
          "Missing proposalId",
          getRequestId(c),
        ),
        400,
      );
    const body = (await c.req.json()) as {
      baseUpdatedAt: string;
      mode: "replace" | "insert_below";
    };

    const proposal =
      await context.repository.getDocumentChangeProposal(proposalId);
    if (!proposal || proposal.userId !== result.bootstrap.user.id) {
      return c.json(
        createErrorPayload("not_found", "Proposal not found", getRequestId(c)),
        404,
      );
    }

    if (proposal.status !== "pending" && proposal.status !== "previewed") {
      return c.json(
        createErrorPayload(
          "stale_ai_proposal",
          "Proposal is in terminal state",
          getRequestId(c),
        ),
        409,
      );
    }

    const documentRecord = await context.repository.getDocumentById({
      userId: result.bootstrap.user.id,
      documentId: proposal.documentId,
    });

    const proposalBaseTime = new Date(proposal.baseUpdatedAt).getTime();
    const docTime = new Date(documentRecord?.updatedAt || 0).getTime();
    const reqTime = new Date(body.baseUpdatedAt).getTime();

    if (
      !documentRecord ||
      docTime !== reqTime ||
      proposalBaseTime !== reqTime
    ) {
      await context.repository.updateDocumentChangeProposalStatus({
        id: proposalId,
        userId: result.bootstrap.user.id,
        status: "invalidated",
      });
      return c.json(
        createErrorPayload(
          "stale_ai_proposal",
          "Stale base apply",
          getRequestId(c),
        ),
        409,
      );
    }

    const appliedProposalJson = {
      ...proposal.proposalJson,
      action: body.mode,
    };
    const updatedContent = applyDocumentChangeProposal(
      documentRecord.contentJson,
      appliedProposalJson as Parameters<typeof applyDocumentChangeProposal>[1],
    );

    try {
      const document = await context.repository.updateDocumentContent({
        userId: result.bootstrap.user.id,
        documentId: proposal.documentId,
        contentJson: updatedContent,
        plainText: toPlainText(updatedContent),
        baseUpdatedAt: body.baseUpdatedAt,
      });

      if (!document) {
        return c.json(
          createErrorPayload(
            "not_found",
            "Document not found",
            getRequestId(c),
          ),
          404,
        );
      }

      const updatedProposal =
        await context.repository.updateDocumentChangeProposalStatus({
          id: proposalId,
          userId: result.bootstrap.user.id,
          status: "applied",
        });

      return c.json({
        document,
        proposal: updatedProposal!,
      });
    } catch (error) {
      if (error instanceof StaleDocumentSaveError) {
        await context.repository.updateDocumentChangeProposalStatus({
          id: proposalId,
          userId: result.bootstrap.user.id,
          status: "invalidated",
        });
        return c.json(
          createErrorPayload(
            "stale_ai_proposal",
            "Stale document save",
            getRequestId(c),
          ),
          409,
        );
      }
      throw error;
    }
  }) as never);

  app.openapi(dismissProposalRoute, (async (c: Context) => {
    const result = await requireAppUser(context, c);
    if (result.error) return result.error;

    const proposalId = c.req.param("proposalId")!;
    if (!proposalId)
      return c.json(
        createErrorPayload(
          "bad_request",
          "Missing proposalId",
          getRequestId(c),
        ),
        400,
      );

    const proposal =
      await context.repository.getDocumentChangeProposal(proposalId);
    if (!proposal || proposal.userId !== result.bootstrap.user.id) {
      return c.json(
        createErrorPayload("not_found", "Proposal not found", getRequestId(c)),
        404,
      );
    }

    if (
      proposal.status === "dismissed" ||
      proposal.status === "invalidated" ||
      proposal.status === "applied"
    ) {
      return c.json({ proposal });
    }

    const updatedProposal =
      await context.repository.updateDocumentChangeProposalStatus({
        id: proposalId,
        userId: result.bootstrap.user.id,
        status: "dismissed",
      });

    return c.json({ proposal: updatedProposal! });
  }) as never);

  const openApiDocumentConfig = {
    openapi: "3.1.0",
    info: apiInfo,
    servers: [
      {
        url: getApiBaseUrl(),
        description: "Configured API base URL",
      },
    ],
  };

  app.doc("/openapi.json", openApiDocumentConfig);

  const llmsMarkdown = createMarkdownFromOpenApi(
    JSON.stringify(app.getOpenAPI31Document(openApiDocumentConfig)),
  );

  app.get(
    "/swagger",
    swaggerUI({
      url: "/openapi.json",
    }),
  );

  app.get(
    "/scalar",
    Scalar({
      url: "/openapi.json",
    }),
  );

  app.get("/llms.txt", async (c) => {
    return c.text(await llmsMarkdown);
  });

  app.notFound((c) => {
    return c.json(
      createErrorPayload("not_found", "Route not found", getRequestId(c)),
      404,
    );
  });

  app.onError((error, c) => {
    context.logger.error("Unhandled API error", error);
    return c.json(
      createErrorPayload(
        "internal_error",
        "Unexpected API error",
        getRequestId(c),
      ),
      500,
    );
  });

  return app;
}
