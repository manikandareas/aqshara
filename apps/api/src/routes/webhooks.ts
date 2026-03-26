import type { WebhookEvent } from "@clerk/backend/webhooks";
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { ErrorSchema } from "../openapi/schemas/common.js";
import type { ApiEnv } from "../hono-env.js";
import { createErrorPayload, getRequestId } from "../http/errors.js";

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

export function registerClerkWebhookRoutes(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(webhookRoute, (async (c: Context<ApiEnv>) => {
    const context = c.get("ctx");
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

    await context.services.webhookUser.handleClerkEvent(event);
    return c.json({ ok: true });
  }) as never);
}
