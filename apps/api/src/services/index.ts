import type { ExportDocxPayload } from "@aqshara/queue";
import type { AppUser } from "../repositories/app-repository.types.js";
import type { AppRepository } from "../repositories/app-repository.types.js";
import type { AiService } from "../lib/ai/service.js";
import type { AppUsage } from "../lib/api-types.js";
import { SessionService } from "./session-service.js";
import { DocumentService } from "./document-service.js";
import { WritingService } from "./writing-service.js";
import { ProposalService } from "./proposal-service.js";
import { WebhookUserService } from "./webhook-user-service.js";
import { ExportService } from "./export-service.js";

export type ApiServices = {
  session: SessionService;
  documents: DocumentService;
  writing: WritingService;
  proposals: ProposalService;
  webhookUser: WebhookUserService;
  exports: ExportService;
};

export function createApiServices(deps: {
  repository: AppRepository;
  aiService: AiService;
  getUsage: (user: AppUser) => Promise<AppUsage>;
  enqueueExportDocx: (
    payload: ExportDocxPayload,
  ) => Promise<{ jobId: string }>;
}): ApiServices {
  return {
    session: new SessionService(deps.repository, deps.getUsage),
    documents: new DocumentService(deps.repository),
    writing: new WritingService(deps.repository, deps.aiService),
    proposals: new ProposalService(deps.repository),
    webhookUser: new WebhookUserService(deps.repository),
    exports: new ExportService(deps.repository, deps.enqueueExportDocx),
  };
}

export { SessionService } from "./session-service.js";
export { DocumentService } from "./document-service.js";
export { WritingService } from "./writing-service.js";
export { ProposalService } from "./proposal-service.js";
export { WebhookUserService } from "./webhook-user-service.js";
export { ExportService } from "./export-service.js";
