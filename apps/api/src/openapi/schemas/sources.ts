import { z } from "@hono/zod-openapi";

export const SourceSchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "processing", "ready", "failed"]),
  mimeType: z.string(),
  originalFileName: z.string(),
  fileSizeBytes: z.number(),
  pageCount: z.number().nullable(),
  retryCount: z.number(),
  errorMessage: z.string().nullable(),
  errorCode: z.string().nullable(),
  processingStartedAt: z.string().nullable(),
  readyAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sourceParamsSchema = z.object({
  sourceId: z.string().uuid().openapi({ param: { name: "sourceId", in: "path" } }),
});
