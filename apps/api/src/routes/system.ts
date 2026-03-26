import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { HealthResponseSchema } from "../openapi/schemas/common.js";
import type { ApiEnv } from "../hono-env.js";

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

export function registerSystemRoutes(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(healthRoute, (c) => {
    return c.json({
      ok: true,
      service: "api",
      timestamp: new Date().toISOString(),
    });
  });
}
