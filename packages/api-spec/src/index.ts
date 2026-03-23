import { z } from "@hono/zod-openapi";

export const apiInfo = {
  title: "Aqshara API",
  version: "0.1.0",
  description: "Internal Aqshara REST API contract.",
};

export const errorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
});
