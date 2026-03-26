import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  AppUserSchema,
  ErrorSchema,
  PlanSummarySchema,
  UsageSchema,
  WorkspaceSchema,
} from "../openapi/schemas/common.js";
import type { ApiEnv } from "../hono-env.js";
import { requireAppUser } from "../http/api-http.js";

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

export function registerSessionRoutes(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(meRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
    const result = await requireAppUser(c);

    if (result.error) {
      return result.error;
    }

    const payload = await context.services.session.getSessionPayload(
      result.bootstrap,
    );
    return c.json(payload);
  }) as never);
}
