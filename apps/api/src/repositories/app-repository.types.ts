import type {
  DocumentValue,
  DocumentChangeProposal,
  TemplateCode,
} from "@aqshara/documents";

export type PlanCode = "free" | "pro";
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

export type PreflightWarningCode =
  | "empty_document_title"
  | "empty_heading"
  | "possible_placeholder";

export type PreflightWarning = {
  code: PreflightWarningCode;
  message: string;
  blockId?: string;
};

export type ExportFormat = "docx";
export type ExportStatus = "queued" | "processing" | "ready" | "failed";

export type AppExport = {
  id: string;
  documentId: string;
  userId: string;
  workspaceId: string;
  billingPeriod: string;
  format: ExportFormat;
  status: ExportStatus;
  idempotencyKey: string | null;
  bullmqJobId: string | null;
  preflightWarnings: PreflightWarning[] | null;
  retryCount: number;
  storageKey: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  processingStartedAt: string | null;
  readyAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SourceStatus = "queued" | "processing" | "ready" | "failed";

export type AppSource = {
  id: string;
  workspaceId: string;
  userId: string;
  billingPeriod: string;
  status: SourceStatus;
  storageKey: string;
  parsedTextStorageKey: string | null;
  /** Set when status is ready; used for storage accounting on delete. */
  parsedTextSizeBytes: number | null;
  mimeType: string;
  originalFileName: string;
  fileSizeBytes: number;
  checksum: string;
  pageCount: number | null;
  bullmqJobId: string | null;
  retryCount: number;
  errorMessage: string | null;
  errorCode: string | null;
  processingStartedAt: string | null;
  readyAt: string | null;
  idempotencyKey: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  getDocumentByIdUnscoped(documentId: string): Promise<AppDocument | null>;
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
  countActiveSourcesForDocument(documentId: string): Promise<number>;
  reserveAiAction(input: {
    userId: string;
    documentId?: string;
    featureKey: string;
    idempotencyKey?: string;
    requestHash?: string;
  }): Promise<{
    allowed: boolean;
    reason?: "idempotency_mismatch" | "quota_exceeded" | "duplicate_in_flight";
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

  requestDocxExport(input: {
    userId: string;
    documentId: string;
    workspaceId: string;
    idempotencyKey: string;
    preflightWarnings: PreflightWarning[];
  }): Promise<
    | { ok: true; export: AppExport; isReplay: boolean }
    | {
        ok: false;
        reason:
          | "document_not_found"
          | "workspace_mismatch"
          | "quota_exceeded"
          | "too_many_in_flight";
      }
  >;

  getExportForUser(input: {
    userId: string;
    exportId: string;
  }): Promise<AppExport | null>;

  listExportsForUser(input: {
    userId: string;
    limit: number;
  }): Promise<AppExport[]>;

  setExportBullmqJobId(input: {
    userId: string;
    exportId: string;
    bullmqJobId: string;
  }): Promise<AppExport | null>;

  retryFailedExport(input: {
    userId: string;
    exportId: string;
  }): Promise<
    | { ok: true; export: AppExport }
    | {
        ok: false;
        reason:
          | "not_found"
          | "not_failed"
          | "quota_exceeded"
          | "too_many_in_flight";
      }
  >;

  markExportFailed(input: {
    userId: string;
    exportId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<AppExport | null>;

  assertSourceRegistrationAllowed(userId: string): Promise<
    | { ok: true }
    | { ok: false; reason: "quota_exceeded" | "too_many_in_flight" }
  >;

  getSourceByUserIdempotency(input: {
    userId: string;
    idempotencyKey: string;
  }): Promise<AppSource | null>;

  findSourceByWorkspaceChecksum(input: {
    workspaceId: string;
    checksum: string;
  }): Promise<AppSource | null>;

  findReadySourceByWorkspaceChecksum(input: {
    workspaceId: string;
    checksum: string;
  }): Promise<AppSource | null>;

  insertQueuedSourceWithLink(input: {
    id: string;
    workspaceId: string;
    userId: string;
    documentId: string;
    billingPeriod: string;
    storageKey: string;
    mimeType: string;
    originalFileName: string;
    fileSizeBytes: number;
    checksum: string;
    pageCount: number;
    idempotencyKey: string | null;
  }): Promise<
    | { ok: true; source: AppSource }
    | {
        ok: false;
        reason:
          | "idempotency_replay"
          | "quota_exceeded"
          | "too_many_in_flight"
          | "document_limit_exceeded";
        source?: AppSource;
      }
  >;

  createDocumentSourceLink(input: {
    documentId: string;
    sourceId: string;
  }): Promise<{ ok: true } | { ok: false; reason: "duplicate_link" }>;

  getSourceForUser(input: {
    userId: string;
    sourceId: string;
  }): Promise<AppSource | null>;

  listSourcesForDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<AppSource[]>;

  /** First document linked to this source that the user can access, if any. */
  getDocumentIdForSource(input: {
    userId: string;
    sourceId: string;
  }): Promise<string | null>;

  setSourceBullmqJobId(input: {
    userId: string;
    sourceId: string;
    bullmqJobId: string;
  }): Promise<AppSource | null>;

  markSourceFailedFromApi(input: {
    userId: string;
    sourceId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<AppSource | null>;

  retryFailedSource(input: {
    userId: string;
    sourceId: string;
    forceOcr?: boolean;
  }): Promise<
    | { ok: true; source: AppSource }
    | {
        ok: false;
        reason:
          | "not_found"
          | "not_failed"
          | "quota_exceeded"
          | "too_many_in_flight";
      }
  >;

  softDeleteSource(input: {
    userId: string;
    sourceId: string;
  }): Promise<
    { ok: true } | { ok: false; reason: "not_found" | "already_deleted" }
  >;
};
