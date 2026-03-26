import type {
  DocumentValue,
  DocumentChangeProposal,
  TemplateCode,
} from "@aqshara/documents";

export type PlanCode = "free";
export type DocumentType = "general_paper" | "proposal" | "skripsi";
export type DocumentStatus = "active" | "archived";

export type AuthIdentity = {
  clerkUserId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export type AppUser = {
  id: string;
  clerkUserId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  planCode: PlanCode;
  deletedAt: string | null;
};

export type Workspace = {
  id: string;
  userId: string;
  name: string;
};

export type AppDocument = {
  id: string;
  workspaceId: string;
  title: string;
  type: DocumentType;
  contentJson: DocumentValue;
  plainText: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppBootstrap = {
  user: AppUser;
  workspace: Workspace;
};

export type DocumentListOptions = {
  userId: string;
  status: DocumentStatus;
};

export type AppDocumentChangeProposal = {
  id: string;
  documentId: string;
  userId: string;
  proposalJson: DocumentChangeProposal;
  actionType: "replace" | "insert_below";
  status: "pending" | "applied" | "dismissed" | "invalidated" | "previewed";
  baseUpdatedAt: string;
  targetBlockIds: string[];
  appliedAt: string | null;
  dismissedAt: string | null;
  invalidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentPatch = {
  title?: string;
  type?: DocumentType;
};

export class StaleDocumentSaveError extends Error {
  constructor() {
    super("Stale document save");
    this.name = "StaleDocumentSaveError";
  }
}

export type AppRepository = {
  getUserByClerkUserId(clerkUserId: string): Promise<AppUser | null>;
  getWorkspaceForUser(userId: string): Promise<Workspace | null>;
  upsertUserFromWebhook(identity: AuthIdentity): Promise<AppBootstrap>;
  softDeleteUserByClerkUserId(clerkUserId: string): Promise<AppUser | null>;
  listDocuments(options: DocumentListOptions): Promise<AppDocument[]>;
  listRecentDocuments(options: {
    userId: string;
    limit: number;
  }): Promise<AppDocument[]>;
  createDocument(input: {
    userId: string;
    title: string;
    type: DocumentType;
  }): Promise<AppDocument>;
  getDocumentById(input: {
    userId: string;
    documentId: string;
  }): Promise<AppDocument | null>;
  updateDocument(input: {
    userId: string;
    documentId: string;
    patch: DocumentPatch;
  }): Promise<AppDocument | null>;
  updateDocumentContent(input: {
    userId: string;
    documentId: string;
    contentJson: DocumentValue;
    plainText: string;
    baseUpdatedAt: string;
  }): Promise<AppDocument | null>;
  archiveDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<AppDocument | null>;
  deleteDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<boolean>;

  countActiveDocuments(userId: string): Promise<number>;
  countArchivedDocuments(userId: string): Promise<number>;
  reserveAiAction(input: {
    userId: string;
    documentId?: string;
    featureKey: string;
    idempotencyKey?: string;
    requestHash?: string;
  }): Promise<{
    allowed: boolean;
    reason?: "idempotency_mismatch" | "quota_exceeded";
    eventId?: string;
    isReplay?: boolean;
    metadataJson?: unknown;
  }>;
  finalizeAiAction(
    eventId: string,
    metadataJson?: Record<string, unknown>,
  ): Promise<void>;
  releaseAiAction(eventId: string): Promise<void>;
  createDocumentChangeProposal(input: {
    documentId: string;
    userId: string;
    proposalJson: DocumentChangeProposal;
    actionType: "replace" | "insert_below";
    baseUpdatedAt: string;
    targetBlockIds: string[];
  }): Promise<AppDocumentChangeProposal>;
  getDocumentChangeProposal(
    id: string,
  ): Promise<AppDocumentChangeProposal | null>;
  updateDocumentChangeProposalStatus(input: {
    id: string;
    userId: string;
    status: "applied" | "dismissed" | "previewed" | "invalidated";
  }): Promise<AppDocumentChangeProposal | null>;
  createTemplateDocument(input: {
    userId: string;
    title: string;
    type: DocumentType;
    templateCode: TemplateCode;
  }): Promise<AppDocument>;
  invalidateStaleProposals(input: {
    documentId: string;
    baseRevisionUpdatedAt: string;
  }): Promise<void>;
};
