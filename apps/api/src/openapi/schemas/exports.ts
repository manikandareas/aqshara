import { z } from "@hono/zod-openapi";

export const PreflightWarningSchema = z.object({
  code: z.enum([
    "empty_document_title",
    "empty_heading",
    "possible_placeholder",
  ]),
  message: z.string(),
  blockId: z.string().optional(),
});

export const ExportSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  userId: z.string(),
  workspaceId: z.string(),
  billingPeriod: z.string(),
  format: z.literal("docx"),
  status: z.enum(["queued", "processing", "ready", "failed"]),
  idempotencyKey: z.string().nullable(),
  bullmqJobId: z.string().nullable(),
  preflightWarnings: z.array(PreflightWarningSchema).nullable(),
  retryCount: z.number(),
  storageKey: z.string().nullable(),
  contentType: z.string().nullable(),
  fileSizeBytes: z.number().nullable(),
  errorMessage: z.string().nullable(),
  errorCode: z.string().nullable(),
  processingStartedAt: z.string().nullable(),
  readyAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
