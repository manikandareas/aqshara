import { Scalar } from "@scalar/hono-api-reference";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import { swaggerUI } from "@hono/swagger-ui";

import { OpenAPIHono } from "@hono/zod-openapi";
import { createFactory } from "hono/factory";
import { apiInfo } from "@aqshara/api-spec";
import { getApiBaseUrl } from "@aqshara/config";
import type { AppContext } from "./lib/app-context.js";
import type { ApiEnv } from "./hono-env.js";
import { createErrorPayload, getRequestId } from "./http/errors.js";
import { logApiErrorEvent } from "./lib/error-events.js";
import {
  createAuthenticatedRateLimiter,
  createIpRateLimiter,
} from "./http/rate-limit-middleware.js";
import { registerSystemRoutes } from "./routes/system.js";
import { registerClerkWebhookRoutes } from "./routes/webhooks.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerProposalRoutes } from "./routes/proposals.js";
import { registerExportRoutes } from "./routes/exports.js";

export const apiFactory = createFactory<ApiEnv>();

export function createApp(context: AppContext) {
  const app = new OpenAPIHono<ApiEnv>();

  app.use("*", async (c, next) => {
    c.set("ctx", context);
    const requestId = getRequestId(c);
    context.logger.info("request", {
      method: c.req.method,
      path: c.req.path,
      requestId,
    });
    await next();
  });
  app.use("/v1/*", context.authMiddleware);
  app.use(
    "/v1/*",
    createAuthenticatedRateLimiter({
      store: context.rateLimitStore,
    }),
  );

  registerSystemRoutes(app);
  app.use(
    "/webhooks/*",
    createIpRateLimiter(400, {
      store: context.rateLimitStore,
    }),
  );
  registerClerkWebhookRoutes(app);
  registerSessionRoutes(app);
  registerDocumentRoutes(app);
  registerProposalRoutes(app);
  registerExportRoutes(app);

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
    const requestId = getRequestId(c);
    context.logger.error("Unhandled API error", error, {
      requestId,
    });
    logApiErrorEvent({
      path: c.req.path,
      requestId,
      code: "unhandled_api_error",
      failureClass: "system",
      message: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      createErrorPayload(
        "internal_error",
        "Unexpected API error",
        requestId,
      ),
      500,
    );
  });

  return app;
}
