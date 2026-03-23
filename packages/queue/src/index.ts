import { z } from "zod";

export const queueNames = {
  exportDocx: "export_docx",
} as const;

export const exportDocxPayloadSchema = z.object({
  documentId: z.string(),
  userId: z.string(),
  workspaceId: z.string(),
  idempotencyKey: z.string(),
});

export type ExportDocxPayload = z.infer<typeof exportDocxPayloadSchema>;

export const jobHandlers: Record<string, (payload: ExportDocxPayload) => Promise<unknown>> = {
  export_docx: async (payload) => {
    return {
      status: "queued",
      ...payload,
    };
  },
};
