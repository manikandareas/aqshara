import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { logLaunchEvent } from "@aqshara/observability";
import { ErrorSchema } from "../openapi/schemas/common.js";
import {
  DocumentSchema,
  ProposalSchema,
} from "../openapi/schemas/documents.js";
import type { ApiEnv } from "../hono-env.js";
import { createErrorPayload, getRequestId, requireAppUser } from "../http/api-http.js";

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

export function registerProposalRoutes(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(applyProposalRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const proposalId = c.req.param("proposalId")!;
    if (!proposalId) {
      return c.json(
        createErrorPayload(
          "bad_request",
          "Missing proposalId",
          getRequestId(c),
        ),
        400,
      );
    }
    const body = (await c.req.json()) as {
      baseUpdatedAt: string;
      mode: "replace" | "insert_below";
    };

    const applyResult = await context.services.proposals.applyProposal({
      userId: result.bootstrap.user.id,
      proposalId,
      baseUpdatedAt: body.baseUpdatedAt,
      mode: body.mode,
    });

    if (applyResult.type === "not_found") {
      return c.json(
        createErrorPayload("not_found", "Proposal not found", getRequestId(c)),
        404,
      );
    }
    if (applyResult.type === "stale_ai_proposal") {
      return c.json(
        createErrorPayload(
          "stale_ai_proposal",
          applyResult.message,
          getRequestId(c),
        ),
        409,
      );
    }
    if (applyResult.type === "stale_document_save") {
      return c.json(
        createErrorPayload(
          "stale_document_save",
          "Stale document save",
          getRequestId(c),
        ),
        409,
      );
    }
    logLaunchEvent("ai.proposal_applied", {
      userId: result.bootstrap.user.id,
      documentId: applyResult.document.id,
      proposalId: applyResult.proposal.id,
      mode: body.mode,
      actionType: applyResult.proposal.actionType,
    });
    return c.json({
      document: applyResult.document,
      proposal: applyResult.proposal,
    });
  }) as never);

  app.openapi(dismissProposalRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);
    if (result.error) return result.error;

    const proposalId = c.req.param("proposalId")!;
    if (!proposalId) {
      return c.json(
        createErrorPayload(
          "bad_request",
          "Missing proposalId",
          getRequestId(c),
        ),
        400,
      );
    }

    const dismissResult = await context.services.proposals.dismissProposal(
      result.bootstrap.user.id,
      proposalId,
    );
    if (dismissResult.type === "not_found") {
      return c.json(
        createErrorPayload("not_found", "Proposal not found", getRequestId(c)),
        404,
      );
    }
    logLaunchEvent("ai.proposal_dismissed", {
      userId: result.bootstrap.user.id,
      documentId: dismissResult.proposal.documentId,
      proposalId: dismissResult.proposal.id,
      status: dismissResult.proposal.status,
    });
    return c.json({ proposal: dismissResult.proposal });
  }) as never);
}
