import type {
  DocumentValue,
  DocumentChangeProposal,
  TemplateCode,
} from "@aqshara/documents";
import { createTemplateDocument, toPlainText } from "@aqshara/documents";
import {
  createDatabase,
  documents,
  users,
  workspaces,
  usageEvents,
  monthlyUsageCounters,
  aiActionsReserved,
  documentChangeProposals,
  documentSourceLinks,
  exportsTable,
  sourcesTable,
} from "@aqshara/database";
import { and, count, desc, eq, inArray, isNull, isNotNull, or } from "drizzle-orm";
import { getCurrentBillingPeriod } from "./billing-period.js";
import {
  PLAN_AI_ACTIONS_LIMIT,
  PLAN_EXPORTS_LIMIT,
  MAX_IN_FLIGHT_EXPORTS_PER_USER,
  MAX_IN_FLIGHT_SOURCES_PER_USER,
  PLAN_SOURCE_UPLOADS_LIMIT,
} from "../lib/plan-limits.js";
import type {
  AppDocument,
  AppDocumentChangeProposal,
  AppExport,
  AppRepository,
  AppSource,
  AppUser,
  AuthIdentity,
  DocumentListOptions,
  DocumentPatch,
  DocumentType,
  PlanCode,
  PreflightWarning,
  Workspace,
} from "./app-repository.types.js";
import {
  StaleDocumentSaveError,
} from "./app-repository.types.js";

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toSourceRecord(row: typeof sourcesTable.$inferSelect): AppSource {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    billingPeriod: row.billingPeriod,
    status: row.status as AppSource["status"],
    storageKey: row.storageKey,
    parsedTextStorageKey: row.parsedTextStorageKey,
    parsedTextSizeBytes: row.parsedTextSizeBytes,
    mimeType: row.mimeType,
    originalFileName: row.originalFileName,
    fileSizeBytes: row.fileSizeBytes,
    checksum: row.checksum,
    pageCount: row.pageCount,
    bullmqJobId: row.bullmqJobId,
    retryCount: row.retryCount,
    errorMessage: row.errorMessage,
    errorCode: row.errorCode,
    processingStartedAt: toIsoString(row.processingStartedAt),
    readyAt: toIsoString(row.readyAt),
    idempotencyKey: row.idempotencyKey,
    deletedAt: toIsoString(row.deletedAt),
    createdAt: toIsoString(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date().toISOString(),
  };
}

function toExportRecord(row: typeof exportsTable.$inferSelect): AppExport {
  return {
    id: row.id,
    documentId: row.documentId,
    userId: row.userId,
    workspaceId: row.workspaceId,
    billingPeriod: row.billingPeriod,
    format: row.format as AppExport["format"],
    status: row.status as AppExport["status"],
    idempotencyKey: row.idempotencyKey,
    bullmqJobId: row.bullmqJobId,
    preflightWarnings: (row.preflightWarnings as PreflightWarning[] | null) ?? null,
    retryCount: row.retryCount,
    storageKey: row.storageKey,
    contentType: row.contentType,
    fileSizeBytes: row.fileSizeBytes,
    errorMessage: row.errorMessage,
    errorCode: row.errorCode,
    processingStartedAt: toIsoString(row.processingStartedAt),
    readyAt: toIsoString(row.readyAt),
    createdAt: toIsoString(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date().toISOString(),
  };
}

function toDocumentRecord(row: typeof documents.$inferSelect): AppDocument {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    type: row.type as DocumentType,
    contentJson: row.contentJson as DocumentValue,
    plainText: row.plainText,
    archivedAt: toIsoString(row.archivedAt),
    createdAt: toIsoString(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date().toISOString(),
  };
}

export class PostgresAppRepository implements AppRepository {
  private readonly db = createDatabase();

  async getUserByClerkUserId(clerkUserId: string): Promise<AppUser | null> {
    const user = (
      await this.db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1)
    )[0];

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      planCode: user.planCode as PlanCode,
      deletedAt: toIsoString(user.deletedAt),
    };
  }

  async getWorkspaceForUser(userId: string): Promise<Workspace | null> {
    const workspace = (
      await this.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.userId, userId))
        .limit(1)
    )[0];

    return workspace ?? null;
  }

  async upsertUserFromWebhook(identity: AuthIdentity): Promise<{
    user: AppUser;
    workspace: Workspace;
  }> {
    const now = new Date();
    const existingUser = (
      await this.db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, identity.clerkUserId))
        .limit(1)
    )[0];

    let user = existingUser;

    if (!user) {
      user = (
        await this.db
          .insert(users)
          .values({
            clerkUserId: identity.clerkUserId,
            email: identity.email,
            name: identity.name,
            avatarUrl: identity.avatarUrl,
            planCode: "free",
            deletedAt: null,
            updatedAt: now,
          })
          .returning()
      )[0];
    }

    if (!user) {
      throw new Error("Failed to create user");
    }

    if (existingUser) {
      user = (
        await this.db
          .update(users)
          .set({
            email: identity.email,
            name: identity.name,
            avatarUrl: identity.avatarUrl,
            deletedAt: null,
            updatedAt: now,
          })
          .where(eq(users.id, existingUser.id))
          .returning()
      )[0]!;
    }

    let workspace = (
      await this.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.userId, user.id))
        .limit(1)
    )[0];

    if (!workspace) {
      workspace = (
        await this.db
          .insert(workspaces)
          .values({
            userId: user.id,
            name: "My Workspace",
            updatedAt: now,
          })
          .returning()
      )[0];
    }

    if (!workspace) {
      throw new Error("Failed to create workspace");
    }

    return {
      user: {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        planCode: user.planCode as PlanCode,
        deletedAt: toIsoString(user.deletedAt),
      },
      workspace,
    };
  }

  async softDeleteUserByClerkUserId(
    clerkUserId: string,
  ): Promise<AppUser | null> {
    const existingUser = (
      await this.db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1)
    )[0];

    if (!existingUser) {
      return null;
    }

    const [user] = await this.db
      .update(users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id))
      .returning();

    if (!user) {
      throw new Error("Failed to soft delete user");
    }

    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      planCode: user.planCode as PlanCode,
      deletedAt: toIsoString(user.deletedAt),
    };
  }

  async listDocuments(options: DocumentListOptions): Promise<AppDocument[]> {
    const rows = await this.db
      .select({ document: documents })
      .from(documents)
      .innerJoin(workspaces, eq(documents.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaces.userId, options.userId),
          options.status === "archived"
            ? isNotNull(documents.archivedAt)
            : isNull(documents.archivedAt),
        ),
      )
      .orderBy(desc(documents.updatedAt));

    return rows.map((row) => toDocumentRecord(row.document));
  }

  async listRecentDocuments(options: {
    userId: string;
    limit: number;
  }): Promise<AppDocument[]> {
    const rows = await this.db
      .select({ document: documents })
      .from(documents)
      .innerJoin(workspaces, eq(documents.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaces.userId, options.userId),
          isNull(documents.archivedAt),
        ),
      )
      .orderBy(desc(documents.updatedAt))
      .limit(options.limit);

    return rows.map((row) => toDocumentRecord(row.document));
  }

  async createDocument(input: {
    userId: string;
    title: string;
    type: DocumentType;
  }): Promise<AppDocument> {
    const workspace = (
      await this.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.userId, input.userId))
        .limit(1)
    )[0];

    if (!workspace) {
      throw new Error("Workspace not found for user");
    }

    const [document] = await this.db
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        title: input.title,
        type: input.type,
        contentJson: [
          { type: "paragraph", id: "root-p", children: [{ text: "" }] },
        ],
        plainText: "",
      })
      .returning();

    if (!document) {
      throw new Error("Failed to create document");
    }

    return toDocumentRecord(document);
  }

  async getDocumentById(input: {
    userId: string;
    documentId: string;
  }): Promise<AppDocument | null> {
    const row = await this.db
      .select({ document: documents })
      .from(documents)
      .innerJoin(workspaces, eq(documents.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaces.userId, input.userId),
          eq(documents.id, input.documentId),
        ),
      )
      .limit(1);

    return row[0] ? toDocumentRecord(row[0].document) : null;
  }

  async getDocumentByIdUnscoped(documentId: string): Promise<AppDocument | null> {
    const row = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    return row[0] ? toDocumentRecord(row[0]) : null;
  }

  async updateDocument(input: {
    userId: string;
    documentId: string;
    patch: DocumentPatch;
  }): Promise<AppDocument | null> {
    const existing = await this.getDocumentById(input);

    if (!existing) {
      return null;
    }

    const [document] = await this.db
      .update(documents)
      .set({
        title: input.patch.title ?? existing.title,
        type: input.patch.type ?? existing.type,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, input.documentId))
      .returning();

    if (!document) {
      throw new Error("Failed to update document");
    }

    return toDocumentRecord(document);
  }

  async updateDocumentContent(input: {
    userId: string;
    documentId: string;
    contentJson: DocumentValue;
    plainText: string;
    baseUpdatedAt: string;
  }): Promise<AppDocument | null> {
    const existing = await this.getDocumentById(input);

    if (!existing) {
      return null;
    }

    if (
      new Date(existing.updatedAt).getTime() >
      new Date(input.baseUpdatedAt).getTime()
    ) {
      throw new StaleDocumentSaveError();
    }

    const [document] = await this.db
      .update(documents)
      .set({
        contentJson: input.contentJson,
        plainText: input.plainText,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, input.documentId))
      .returning();

    if (!document) {
      throw new Error("Failed to save document");
    }

    return toDocumentRecord(document);
  }

  async archiveDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<AppDocument | null> {
    const existing = await this.getDocumentById(input);

    if (!existing) {
      return null;
    }

    const [document] = await this.db
      .update(documents)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, input.documentId))
      .returning();

    if (!document) {
      throw new Error("Failed to archive document");
    }

    return toDocumentRecord(document);
  }

  async countActiveDocuments(userId: string): Promise<number> {
    const rows = await this.db
      .select({ count: documents.id })
      .from(documents)
      .innerJoin(workspaces, eq(documents.workspaceId, workspaces.id))
      .where(and(eq(workspaces.userId, userId), isNull(documents.archivedAt)));
    return rows.length;
  }

  async countArchivedDocuments(userId: string): Promise<number> {
    const rows = await this.db
      .select({ count: documents.id })
      .from(documents)
      .innerJoin(workspaces, eq(documents.workspaceId, workspaces.id))
      .where(
        and(eq(workspaces.userId, userId), isNotNull(documents.archivedAt)),
      );
    return rows.length;
  }

  async reserveAiAction(input: {
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
  }> {
    const period = getCurrentBillingPeriod();

    if (input.idempotencyKey) {
      const existingEvent = (
        await this.db
          .select()
          .from(usageEvents)
          .where(
            and(
              eq(usageEvents.userId, input.userId),
              eq(usageEvents.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1)
      )[0];

      if (existingEvent) {
        if (existingEvent.requestHash !== input.requestHash) {
          return { allowed: false, reason: "idempotency_mismatch" };
        }
        return {
          allowed: true,
          eventId: existingEvent.id,
          isReplay: existingEvent.status === "succeeded",
          metadataJson: existingEvent.metadataJson,
        };
      }
    }

    const counters = (
      await this.db
        .select()
        .from(monthlyUsageCounters)
        .where(
          and(
            eq(monthlyUsageCounters.userId, input.userId),
            eq(monthlyUsageCounters.period, period),
          ),
        )
        .limit(1)
    )[0];

    const used = counters?.aiActionsUsed ?? 0;

    const reservedRecord = (
      await this.db
        .select()
        .from(aiActionsReserved)
        .where(
          and(
            eq(aiActionsReserved.userId, input.userId),
            eq(aiActionsReserved.period, period),
          ),
        )
        .limit(1)
    )[0];

    const reserved = reservedRecord?.aiActionsReserved ?? 0;

    if (used + reserved >= PLAN_AI_ACTIONS_LIMIT) {
      return { allowed: false, reason: "quota_exceeded" };
    }

    if (reservedRecord) {
      await this.db
        .update(aiActionsReserved)
        .set({ aiActionsReserved: reserved + 1, updatedAt: new Date() })
        .where(eq(aiActionsReserved.id, reservedRecord.id));
    } else {
      await this.db.insert(aiActionsReserved).values({
        userId: input.userId,
        period,
        aiActionsReserved: 1,
      });
    }

    const [event] = await this.db
      .insert(usageEvents)
      .values({
        userId: input.userId,
        documentId: input.documentId,
        billingPeriod: period,
        featureKey: input.featureKey,
        eventType: "ai_action",
        status: "reserved",
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
      })
      .returning();

    return { allowed: true, eventId: event!.id };
  }

  async finalizeAiAction(
    eventId: string,
    metadataJson?: Record<string, unknown>,
  ): Promise<void> {
    const event = (
      await this.db
        .select()
        .from(usageEvents)
        .where(eq(usageEvents.id, eventId))
        .limit(1)
    )[0];
    if (!event || event.status !== "reserved") return;

    await this.db
      .update(usageEvents)
      .set({
        status: "succeeded",
        completedAt: new Date(),
        ...(metadataJson ? { metadataJson } : {}),
      })
      .where(eq(usageEvents.id, eventId));

    const period = event.billingPeriod;
    const counters = (
      await this.db
        .select()
        .from(monthlyUsageCounters)
        .where(
          and(
            eq(monthlyUsageCounters.userId, event.userId),
            eq(monthlyUsageCounters.period, period),
          ),
        )
        .limit(1)
    )[0];

    if (counters) {
      await this.db
        .update(monthlyUsageCounters)
        .set({
          aiActionsUsed: counters.aiActionsUsed + 1,
          updatedAt: new Date(),
        })
        .where(eq(monthlyUsageCounters.id, counters.id));
    } else {
      await this.db.insert(monthlyUsageCounters).values({
        userId: event.userId,
        period,
        aiActionsUsed: 1,
      });
    }

    const reservedRecord = (
      await this.db
        .select()
        .from(aiActionsReserved)
        .where(
          and(
            eq(aiActionsReserved.userId, event.userId),
            eq(aiActionsReserved.period, period),
          ),
        )
        .limit(1)
    )[0];
    if (reservedRecord && reservedRecord.aiActionsReserved > 0) {
      await this.db
        .update(aiActionsReserved)
        .set({
          aiActionsReserved: reservedRecord.aiActionsReserved - 1,
          updatedAt: new Date(),
        })
        .where(eq(aiActionsReserved.id, reservedRecord.id));
    }
  }

  async releaseAiAction(eventId: string): Promise<void> {
    const event = (
      await this.db
        .select()
        .from(usageEvents)
        .where(eq(usageEvents.id, eventId))
        .limit(1)
    )[0];
    if (!event || event.status !== "reserved") return;

    await this.db
      .update(usageEvents)
      .set({ status: "released", releasedAt: new Date() })
      .where(eq(usageEvents.id, eventId));

    const period = event.billingPeriod;
    const reservedRecord = (
      await this.db
        .select()
        .from(aiActionsReserved)
        .where(
          and(
            eq(aiActionsReserved.userId, event.userId),
            eq(aiActionsReserved.period, period),
          ),
        )
        .limit(1)
    )[0];
    if (reservedRecord && reservedRecord.aiActionsReserved > 0) {
      await this.db
        .update(aiActionsReserved)
        .set({
          aiActionsReserved: reservedRecord.aiActionsReserved - 1,
          updatedAt: new Date(),
        })
        .where(eq(aiActionsReserved.id, reservedRecord.id));
    }
  }

  async createDocumentChangeProposal(input: {
    documentId: string;
    userId: string;
    proposalJson: DocumentChangeProposal;
    actionType: "replace" | "insert_below";
    baseUpdatedAt: string;
    targetBlockIds: string[];
  }): Promise<AppDocumentChangeProposal> {
    const [row] = await this.db
      .insert(documentChangeProposals)
      .values({
        documentId: input.documentId,
        userId: input.userId,
        proposalJson: input.proposalJson,
        actionType: input.actionType,
        status: "pending",
        baseUpdatedAt: new Date(input.baseUpdatedAt),
        targetBlockIds: input.targetBlockIds,
      })
      .returning();

    if (!row) throw new Error("Insert failed");
    return {
      ...row,
      proposalJson: row.proposalJson as DocumentChangeProposal,
      actionType: row.actionType as "replace" | "insert_below",
      status: row.status as "pending",
      baseUpdatedAt: row.baseUpdatedAt.toISOString(),
      appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
      dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : null,
      invalidatedAt: row.invalidatedAt ? row.invalidatedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getDocumentChangeProposal(
    id: string,
  ): Promise<AppDocumentChangeProposal | null> {
    const row = (
      await this.db
        .select()
        .from(documentChangeProposals)
        .where(eq(documentChangeProposals.id, id))
        .limit(1)
    )[0];
    if (!row) return null;
    return {
      ...row,
      proposalJson: row.proposalJson as DocumentChangeProposal,
      actionType: row.actionType as "replace" | "insert_below",
      status: row.status as AppDocumentChangeProposal["status"],
      baseUpdatedAt: row.baseUpdatedAt.toISOString(),
      appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
      dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : null,
      invalidatedAt: row.invalidatedAt ? row.invalidatedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateDocumentChangeProposalStatus(input: {
    id: string;
    userId: string;
    status: "applied" | "dismissed" | "previewed" | "invalidated";
  }): Promise<AppDocumentChangeProposal | null> {
    const now = new Date();
    const updates = {
      status: input.status,
      updatedAt: now,
      ...(input.status === "applied" ? { appliedAt: now } : {}),
      ...(input.status === "dismissed" ? { dismissedAt: now } : {}),
      ...(input.status === "invalidated" ? { invalidatedAt: now } : {}),
    };

    const [row] = await this.db
      .update(documentChangeProposals)
      .set(updates)
      .where(
        and(
          eq(documentChangeProposals.id, input.id),
          eq(documentChangeProposals.userId, input.userId),
        ),
      )
      .returning();

    if (!row) return null;
    return {
      ...row,
      proposalJson: row.proposalJson as DocumentChangeProposal,
      actionType: row.actionType as "replace" | "insert_below",
      status: row.status as AppDocumentChangeProposal["status"],
      baseUpdatedAt: row.baseUpdatedAt.toISOString(),
      appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
      dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : null,
      invalidatedAt: row.invalidatedAt ? row.invalidatedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createTemplateDocument(input: {
    userId: string;
    title: string;
    type: DocumentType;
    templateCode: TemplateCode;
  }): Promise<AppDocument> {
    const workspace = (
      await this.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.userId, input.userId))
        .limit(1)
    )[0];

    if (!workspace) {
      throw new Error("Workspace not found for user");
    }

    const contentJson = createTemplateDocument(input.templateCode);

    const [document] = await this.db
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        title: input.title,
        type: input.type,
        contentJson,
        plainText: toPlainText(contentJson),
      })
      .returning();

    if (!document) throw new Error("Insert failed");
    return {
      id: document.id,
      workspaceId: document.workspaceId,
      title: document.title,
      type: document.type as DocumentType,
      contentJson: document.contentJson as DocumentValue,
      plainText: document.plainText,
      archivedAt: document.archivedAt
        ? document.archivedAt.toISOString()
        : null,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }

  private async countInFlightExports(
    userId: string,
    period: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(exportsTable)
      .where(
        and(
          eq(exportsTable.userId, userId),
          eq(exportsTable.billingPeriod, period),
          or(
            eq(exportsTable.status, "queued"),
            eq(exportsTable.status, "processing"),
          ),
        ),
      );
    return Number(row?.n ?? 0);
  }

  private async getExportsUsed(userId: string, period: string): Promise<number> {
    const counters = (
      await this.db
        .select()
        .from(monthlyUsageCounters)
        .where(
          and(
            eq(monthlyUsageCounters.userId, userId),
            eq(monthlyUsageCounters.period, period),
          ),
        )
        .limit(1)
    )[0];
    return counters?.exportsUsed ?? 0;
  }

  async requestDocxExport(input: {
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
  > {
    const document = await this.getDocumentById({
      userId: input.userId,
      documentId: input.documentId,
    });

    if (!document) {
      return { ok: false, reason: "document_not_found" };
    }

    if (document.workspaceId !== input.workspaceId) {
      return { ok: false, reason: "workspace_mismatch" };
    }

    const existing = (
      await this.db
        .select()
        .from(exportsTable)
        .where(
          and(
            eq(exportsTable.userId, input.userId),
            eq(exportsTable.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1)
    )[0];

    if (existing) {
      return {
        ok: true,
        export: toExportRecord(existing),
        isReplay: true,
      };
    }

    const period = getCurrentBillingPeriod();

    if ((await this.countInFlightExports(input.userId, period)) >= MAX_IN_FLIGHT_EXPORTS_PER_USER) {
      return { ok: false, reason: "too_many_in_flight" };
    }

    if ((await this.getExportsUsed(input.userId, period)) >= PLAN_EXPORTS_LIMIT) {
      return { ok: false, reason: "quota_exceeded" };
    }

    try {
      const [row] = await this.db
        .insert(exportsTable)
        .values({
          documentId: input.documentId,
          userId: input.userId,
          workspaceId: input.workspaceId,
          billingPeriod: period,
          format: "docx",
          status: "queued",
          idempotencyKey: input.idempotencyKey,
          preflightWarnings: input.preflightWarnings,
        })
        .returning();

      if (!row) {
        throw new Error("Export insert failed");
      }

      return { ok: true, export: toExportRecord(row), isReplay: false };
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
          ? (error as { code: string }).code
          : null;

      if (code === "23505") {
        const replay = (
          await this.db
            .select()
            .from(exportsTable)
            .where(
              and(
                eq(exportsTable.userId, input.userId),
                eq(exportsTable.idempotencyKey, input.idempotencyKey),
              ),
            )
            .limit(1)
        )[0];
        if (replay) {
          return {
            ok: true,
            export: toExportRecord(replay),
            isReplay: true,
          };
        }
      }

      throw error;
    }
  }

  async getExportForUser(input: {
    userId: string;
    exportId: string;
  }): Promise<AppExport | null> {
    const row = (
      await this.db
        .select()
        .from(exportsTable)
        .where(
          and(
            eq(exportsTable.id, input.exportId),
            eq(exportsTable.userId, input.userId),
          ),
        )
        .limit(1)
    )[0];
    return row ? toExportRecord(row) : null;
  }

  async listExportsForUser(input: {
    userId: string;
    limit: number;
  }): Promise<AppExport[]> {
    const rows = await this.db
      .select()
      .from(exportsTable)
      .where(eq(exportsTable.userId, input.userId))
      .orderBy(desc(exportsTable.createdAt))
      .limit(input.limit);

    return rows.map(toExportRecord);
  }

  async setExportBullmqJobId(input: {
    userId: string;
    exportId: string;
    bullmqJobId: string;
  }): Promise<AppExport | null> {
    const now = new Date();
    const [row] = await this.db
      .update(exportsTable)
      .set({ bullmqJobId: input.bullmqJobId, updatedAt: now })
      .where(
        and(
          eq(exportsTable.id, input.exportId),
          eq(exportsTable.userId, input.userId),
        ),
      )
      .returning();

    return row ? toExportRecord(row) : null;
  }

  async markExportFailed(input: {
    userId: string;
    exportId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<AppExport | null> {
    const now = new Date();
    const [row] = await this.db
      .update(exportsTable)
      .set({
        status: "failed",
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        updatedAt: now,
      })
      .where(
        and(
          eq(exportsTable.id, input.exportId),
          eq(exportsTable.userId, input.userId),
          eq(exportsTable.status, "queued"),
        ),
      )
      .returning();

    return row ? toExportRecord(row) : null;
  }

  async retryFailedExport(input: {
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
  > {
    const current = await this.getExportForUser({
      userId: input.userId,
      exportId: input.exportId,
    });

    if (!current) {
      return { ok: false, reason: "not_found" };
    }

    if (current.status !== "failed") {
      return { ok: false, reason: "not_failed" };
    }

    const period = getCurrentBillingPeriod();

    if ((await this.countInFlightExports(input.userId, period)) >= MAX_IN_FLIGHT_EXPORTS_PER_USER) {
      return { ok: false, reason: "too_many_in_flight" };
    }

    if ((await this.getExportsUsed(input.userId, period)) >= PLAN_EXPORTS_LIMIT) {
      return { ok: false, reason: "quota_exceeded" };
    }

    const now = new Date();
    const [row] = await this.db
      .update(exportsTable)
      .set({
        status: "queued",
        bullmqJobId: null,
        errorMessage: null,
        errorCode: null,
        processingStartedAt: null,
        retryCount: current.retryCount + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(exportsTable.id, input.exportId),
          eq(exportsTable.userId, input.userId),
        ),
      )
      .returning();

    if (!row) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: true, export: toExportRecord(row) };
  }

  private async countInFlightSources(
    userId: string,
    period: string,
  ): Promise<number> {
    const row = await this.db
      .select({ n: count() })
      .from(sourcesTable)
      .where(
        and(
          eq(sourcesTable.userId, userId),
          eq(sourcesTable.billingPeriod, period),
          isNull(sourcesTable.deletedAt),
          or(
            eq(sourcesTable.status, "queued"),
            eq(sourcesTable.status, "processing"),
          ),
        ),
      );
    return Number(row[0]?.n ?? 0);
  }

  async assertSourceRegistrationAllowed(
    userId: string,
  ): Promise<
    | { ok: true }
    | { ok: false; reason: "quota_exceeded" | "too_many_in_flight" }
  > {
    const period = getCurrentBillingPeriod();

    if (
      (await this.countInFlightSources(userId, period)) >=
      MAX_IN_FLIGHT_SOURCES_PER_USER
    ) {
      return { ok: false, reason: "too_many_in_flight" };
    }

    if (
      (await this.getSourceUploadsUsed(userId, period)) >=
      PLAN_SOURCE_UPLOADS_LIMIT
    ) {
      return { ok: false, reason: "quota_exceeded" };
    }

    return { ok: true };
  }

  private async getSourceUploadsUsed(
    userId: string,
    period: string,
  ): Promise<number> {
    const counters = (
      await this.db
        .select()
        .from(monthlyUsageCounters)
        .where(
          and(
            eq(monthlyUsageCounters.userId, userId),
            eq(monthlyUsageCounters.period, period),
          ),
        )
        .limit(1)
    )[0];
    return counters?.sourceUploadsUsed ?? 0;
  }

  async getSourceByUserIdempotency(input: {
    userId: string;
    idempotencyKey: string;
  }): Promise<AppSource | null> {
    const row = (
      await this.db
        .select()
        .from(sourcesTable)
        .where(
          and(
            eq(sourcesTable.userId, input.userId),
            eq(sourcesTable.idempotencyKey, input.idempotencyKey),
            isNull(sourcesTable.deletedAt),
          ),
        )
        .limit(1)
    )[0];
    return row ? toSourceRecord(row) : null;
  }

  async findReadySourceByWorkspaceChecksum(input: {
    workspaceId: string;
    checksum: string;
  }): Promise<AppSource | null> {
    const row = (
      await this.db
        .select()
        .from(sourcesTable)
        .where(
          and(
            eq(sourcesTable.workspaceId, input.workspaceId),
            eq(sourcesTable.checksum, input.checksum),
            eq(sourcesTable.status, "ready"),
            isNull(sourcesTable.deletedAt),
          ),
        )
        .orderBy(desc(sourcesTable.createdAt))
        .limit(1)
    )[0];
    return row ? toSourceRecord(row) : null;
  }

  async insertQueuedSourceWithLink(input: {
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
    | { ok: false; reason: "idempotency_replay"; source: AppSource }
  > {
    if (input.idempotencyKey) {
      const replay = await this.getSourceByUserIdempotency({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      });
      if (replay) {
        return { ok: false, reason: "idempotency_replay", source: replay };
      }
    }

    const period = input.billingPeriod;
    const now = new Date();

    try {
      const source = await this.db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(sourcesTable)
          .values({
            id: input.id,
            workspaceId: input.workspaceId,
            userId: input.userId,
            billingPeriod: period,
            status: "queued",
            storageKey: input.storageKey,
            mimeType: input.mimeType,
            originalFileName: input.originalFileName,
            fileSizeBytes: input.fileSizeBytes,
            checksum: input.checksum,
            pageCount: input.pageCount,
            idempotencyKey: input.idempotencyKey,
            updatedAt: now,
          })
          .returning();

        if (!inserted) {
          throw new Error("Source insert failed");
        }

        await tx.insert(documentSourceLinks).values({
          documentId: input.documentId,
          sourceId: inserted.id,
        });

        const counters = (
          await tx
            .select()
            .from(monthlyUsageCounters)
            .where(
              and(
                eq(monthlyUsageCounters.userId, input.userId),
                eq(monthlyUsageCounters.period, period),
              ),
            )
            .limit(1)
        )[0];

        const storageDelta = input.fileSizeBytes;

        if (counters) {
          await tx
            .update(monthlyUsageCounters)
            .set({
              storageUsedBytes: counters.storageUsedBytes + storageDelta,
              updatedAt: now,
            })
            .where(eq(monthlyUsageCounters.id, counters.id));
        } else {
          await tx.insert(monthlyUsageCounters).values({
            userId: input.userId,
            period,
            storageUsedBytes: storageDelta,
          });
        }

        return inserted;
      });

      return { ok: true, source: toSourceRecord(source) };
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
          ? (error as { code: string }).code
          : null;

      if (code === "23505" && input.idempotencyKey) {
        const replay = await this.getSourceByUserIdempotency({
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        });
        if (replay) {
          return { ok: false, reason: "idempotency_replay", source: replay };
        }
      }

      throw error;
    }
  }

  async createDocumentSourceLink(input: {
    documentId: string;
    sourceId: string;
  }): Promise<{ ok: true } | { ok: false; reason: "duplicate_link" }> {
    try {
      await this.db.insert(documentSourceLinks).values({
        documentId: input.documentId,
        sourceId: input.sourceId,
      });
      return { ok: true };
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
          ? (error as { code: string }).code
          : null;
      if (code === "23505") {
        return { ok: false, reason: "duplicate_link" };
      }
      throw error;
    }
  }

  async getSourceForUser(input: {
    userId: string;
    sourceId: string;
  }): Promise<AppSource | null> {
    const row = (
      await this.db
        .select()
        .from(sourcesTable)
        .where(
          and(
            eq(sourcesTable.id, input.sourceId),
            eq(sourcesTable.userId, input.userId),
            isNull(sourcesTable.deletedAt),
          ),
        )
        .limit(1)
    )[0];
    return row ? toSourceRecord(row) : null;
  }

  async listSourcesForDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<AppSource[]> {
    const doc = await this.getDocumentById({
      userId: input.userId,
      documentId: input.documentId,
    });
    if (!doc) {
      return [];
    }

    const links = await this.db
      .select()
      .from(documentSourceLinks)
      .where(eq(documentSourceLinks.documentId, input.documentId));

    const ids = links.map((l) => l.sourceId);
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(sourcesTable)
      .where(
        and(inArray(sourcesTable.id, ids), isNull(sourcesTable.deletedAt)),
      )
      .orderBy(desc(sourcesTable.createdAt));

    return rows.map(toSourceRecord);
  }

  async getDocumentIdForSource(input: {
    userId: string;
    sourceId: string;
  }): Promise<string | null> {
    const source = await this.getSourceForUser({
      userId: input.userId,
      sourceId: input.sourceId,
    });
    if (!source) {
      return null;
    }

    const links = await this.db
      .select()
      .from(documentSourceLinks)
      .where(eq(documentSourceLinks.sourceId, input.sourceId))
      .orderBy(desc(documentSourceLinks.createdAt));

    const workspace = await this.getWorkspaceForUser(input.userId);
    if (!workspace) {
      return null;
    }

    for (const link of links) {
      const doc = await this.getDocumentByIdUnscoped(link.documentId);
      if (doc && doc.workspaceId === workspace.id) {
        return link.documentId;
      }
    }

    return null;
  }

  async setSourceBullmqJobId(input: {
    userId: string;
    sourceId: string;
    bullmqJobId: string;
  }): Promise<AppSource | null> {
    const now = new Date();
    const [row] = await this.db
      .update(sourcesTable)
      .set({ bullmqJobId: input.bullmqJobId, updatedAt: now })
      .where(
        and(
          eq(sourcesTable.id, input.sourceId),
          eq(sourcesTable.userId, input.userId),
          isNull(sourcesTable.deletedAt),
        ),
      )
      .returning();

    return row ? toSourceRecord(row) : null;
  }

  async markSourceFailedFromApi(input: {
    userId: string;
    sourceId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<AppSource | null> {
    const now = new Date();
    const [row] = await this.db
      .update(sourcesTable)
      .set({
        status: "failed",
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        updatedAt: now,
      })
      .where(
        and(
          eq(sourcesTable.id, input.sourceId),
          eq(sourcesTable.userId, input.userId),
          eq(sourcesTable.status, "queued"),
          isNull(sourcesTable.deletedAt),
        ),
      )
      .returning();

    return row ? toSourceRecord(row) : null;
  }

  async retryFailedSource(input: {
    userId: string;
    sourceId: string;
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
  > {
    const current = await this.getSourceForUser({
      userId: input.userId,
      sourceId: input.sourceId,
    });

    if (!current) {
      return { ok: false, reason: "not_found" };
    }

    if (current.status !== "failed") {
      return { ok: false, reason: "not_failed" };
    }

    const period = getCurrentBillingPeriod();

    if (
      (await this.countInFlightSources(input.userId, period)) >=
      MAX_IN_FLIGHT_SOURCES_PER_USER
    ) {
      return { ok: false, reason: "too_many_in_flight" };
    }

    if (
      (await this.getSourceUploadsUsed(input.userId, period)) >=
      PLAN_SOURCE_UPLOADS_LIMIT
    ) {
      return { ok: false, reason: "quota_exceeded" };
    }

    const now = new Date();
    const [row] = await this.db
      .update(sourcesTable)
      .set({
        status: "queued",
        bullmqJobId: null,
        errorMessage: null,
        errorCode: null,
        processingStartedAt: null,
        retryCount: current.retryCount + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(sourcesTable.id, input.sourceId),
          eq(sourcesTable.userId, input.userId),
          isNull(sourcesTable.deletedAt),
        ),
      )
      .returning();

    if (!row) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: true, source: toSourceRecord(row) };
  }

  async softDeleteSource(input: {
    userId: string;
    sourceId: string;
  }): Promise<
    { ok: true } | { ok: false; reason: "not_found" | "already_deleted" }
  > {
    const row = (
      await this.db
        .select()
        .from(sourcesTable)
        .where(
          and(
            eq(sourcesTable.id, input.sourceId),
            eq(sourcesTable.userId, input.userId),
          ),
        )
        .limit(1)
    )[0];

    if (!row) {
      return { ok: false, reason: "not_found" };
    }

    if (row.deletedAt) {
      return { ok: false, reason: "already_deleted" };
    }

    const now = new Date();
    const storageSubtract =
      row.fileSizeBytes + (row.parsedTextSizeBytes ?? 0);

    await this.db.transaction(async (tx) => {
      await tx
        .delete(documentSourceLinks)
        .where(eq(documentSourceLinks.sourceId, input.sourceId));

      const counters = (
        await tx
          .select()
          .from(monthlyUsageCounters)
          .where(
            and(
              eq(monthlyUsageCounters.userId, row.userId),
              eq(monthlyUsageCounters.period, row.billingPeriod),
            ),
          )
          .limit(1)
      )[0];

      if (counters && storageSubtract > 0) {
        await tx
          .update(monthlyUsageCounters)
          .set({
            storageUsedBytes: Math.max(
              0,
              counters.storageUsedBytes - storageSubtract,
            ),
            updatedAt: now,
          })
          .where(eq(monthlyUsageCounters.id, counters.id));
      }

      await tx
        .update(sourcesTable)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(sourcesTable.id, input.sourceId));
    });

    return { ok: true };
  }

  async invalidateStaleProposals(input: {
    documentId: string;
    baseRevisionUpdatedAt: string;
  }): Promise<void> {
    const baseDate = new Date(input.baseRevisionUpdatedAt);

    const activeProposals = await this.db
      .select()
      .from(documentChangeProposals)
      .where(eq(documentChangeProposals.documentId, input.documentId));

    const toInvalidate = activeProposals.filter(
      (p) =>
        (p.status === "pending" || p.status === "previewed") &&
        p.baseUpdatedAt.getTime() < baseDate.getTime(),
    );

    for (const p of toInvalidate) {
      await this.db
        .update(documentChangeProposals)
        .set({
          status: "invalidated",
          invalidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(documentChangeProposals.id, p.id));
    }
  }

  async deleteDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<boolean> {
    const existing = await this.getDocumentById(input);

    if (!existing) {
      return false;
    }

    await this.db.delete(documents).where(eq(documents.id, input.documentId));
    return true;
  }
}
