import { z } from "zod";

export const queueNames = {
  exportDocx: "export_docx",
  parseSource: "parse_source",
} as const;

/** BullMQ job name for DOCX export jobs. */
export const exportDocxJobName = "export_docx" as const;

export const exportDocxPayloadSchema = z.object({
  exportId: z.string().min(1),
  documentId: z.string().min(1),
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
});

export type ExportDocxPayload = z.infer<typeof exportDocxPayloadSchema>;

/** BullMQ job name for PDF source parse jobs. */
export const parseSourceJobName = "parse_source" as const;

export const parseSourcePayloadSchema = z.object({
  sourceId: z.string().min(1),
  documentId: z.string().min(1),
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
});

export type ParseSourcePayload = z.infer<typeof parseSourcePayloadSchema>;
