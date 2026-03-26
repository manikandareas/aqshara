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
import { registerSystemRoutes } from "./routes/system.js";
import { registerClerkWebhookRoutes } from "./routes/webhooks.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerProposalRoutes } from "./routes/proposals.js";

export const apiFactory = createFactory<ApiEnv>();

export function createApp(context: AppContext) {
  const app = new OpenAPIHono<ApiEnv>();

  app.use("*", async (c, next) => {
    c.set("ctx", context);
    context.logger.info(`${c.req.method} ${c.req.path}`);
    await next();
  });
  app.use("/v1/*", context.authMiddleware);

  registerSystemRoutes(app);
  registerClerkWebhookRoutes(app);
  registerSessionRoutes(app);
  registerDocumentRoutes(app);
  registerProposalRoutes(app);

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
