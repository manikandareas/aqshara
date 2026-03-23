import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiInfo } from "@aqshara/api-spec";
import { getApiBaseUrl } from "@aqshara/config";
import { createLogger } from "@aqshara/observability";

const app = new OpenAPIHono();
const logger = createLogger("api");

const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.literal("api"),
  timestamp: z.string(),
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

app.use("*", async (c, next) => {
  logger.info(`${c.req.method} ${c.req.path}`);
  await next();
});

app.openapi(healthRoute, (c) => {
  return c.json({
    ok: true,
    service: "api",
    timestamp: new Date().toISOString(),
  });
});

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: apiInfo,
  servers: [
    {
      url: getApiBaseUrl(),
      description: "Configured API base URL",
    },
  ],
});

app.get(
  "/swagger",
  swaggerUI({
    url: "/openapi.json",
  }),
);

app.notFound((c) => {
  return c.json(
    {
      code: "not_found",
      message: "Route not found",
      requestId: c.req.header("x-request-id") ?? "local",
    },
    404,
  );
});

app.onError((error, c) => {
  logger.error("Unhandled API error", error);
  return c.json(
    {
      code: "internal_error",
      message: "Unexpected API error",
      requestId: c.req.header("x-request-id") ?? "local",
    },
    500,
  );
});

export default app;
