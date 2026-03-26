import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { WebhookEvent } from "@clerk/backend/webhooks";
import { verifyWebhook } from "@clerk/backend/webhooks";
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
} from "@aqshara/database";
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { Logger } from "./logger.js";
import { createLogger } from "./logger.js";

import { AiService, FakeAiProvider } from "./ai/index.js";

export function getCurrentBillingPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type PlanCode = "free";
export type DocumentType = "general_paper" | "proposal" | "skripsi";
export type DocumentStatus = "active" | "archived";

export type AuthIdentity = {
  clerkUserId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export type ClerkUserEmailAddress = {
  id: string | null;
  email_address: string | null;
};

export type ClerkProvisioningUser = {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: ClerkUserEmailAddress[];
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
};

export type ClerkUsersPage = {
  users: ClerkProvisioningUser[];
};

export type ClerkUsersPageLister = (input: {
  limit: number;
  offset: number;
}) => Promise<ClerkUsersPage>;

export type ClerkBackfillSummary = {
  pagesProcessed: number;
  usersSeen: number;
  usersSynced: number;
  duplicateUsersSkipped: number;
  usersSkippedDeleted: number;
  usersSkippedMissingEmail: number;
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

export type AppUsage = {
  period: string;
  aiActionsUsed: number;
  aiActionsReserved: number;
  aiActionsRemaining: number;
  exportsRemaining: number;
  sourceUploadsRemaining: number;
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
  finalizeAiAction(eventId: string, metadataJson?: Record<string, unknown>): Promise<void>;
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

export type AppContext = {
  authMiddleware: MiddlewareHandler;
  getAuthenticatedClerkUserId: (requestContext: {
    req: {
      header: (name: string) => string | undefined;
    };
  }) => Promise<string | null>;
  verifyWebhook: (request: Request) => Promise<WebhookEvent>;
  repository: AppRepository;
  logger: Logger;
  getUsage: (user: AppUser) => Promise<AppUsage>;
  aiService: AiService;
};

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
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

export function toProvisioningIdentity(
  user: ClerkProvisioningUser,
): AuthIdentity | null {
  const primaryEmail =
    user.email_addresses.find(
      (entry) => entry.id === user.primary_email_address_id,
    ) ?? user.email_addresses[0];

  if (!primaryEmail?.email_address) {
    return null;
  }

  return {
    clerkUserId: user.id,
    email: primaryEmail.email_address,
    name:
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.username ||
      null,
    avatarUrl: user.image_url ?? null,
  };
}

export async function backfillClerkUsers(input: {
  repository: Pick<
    AppRepository,
    "getUserByClerkUserId" | "upsertUserFromWebhook"
  >;
  listUsersPage: ClerkUsersPageLister;
  pageSize?: number;
  logger?: Pick<Logger, "info">;
}): Promise<ClerkBackfillSummary> {
  const pageSize = input.pageSize ?? 100;

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Backfill page size must be at least 1");
  }

  const seenClerkUserIds = new Set<string>();
  const summary: ClerkBackfillSummary = {
    pagesProcessed: 0,
    usersSeen: 0,
    usersSynced: 0,
    duplicateUsersSkipped: 0,
    usersSkippedDeleted: 0,
    usersSkippedMissingEmail: 0,
  };

  for (let offset = 0; ; offset += pageSize) {
    const page = await input.listUsersPage({
      limit: pageSize,
      offset,
    });

    if (page.users.length === 0) {
      break;
    }

    summary.pagesProcessed += 1;

    for (const user of page.users) {
      if (seenClerkUserIds.has(user.id)) {
        summary.duplicateUsersSkipped += 1;
        continue;
      }

      seenClerkUserIds.add(user.id);
      summary.usersSeen += 1;

      const identity = toProvisioningIdentity(user);

      if (!identity) {
        summary.usersSkippedMissingEmail += 1;
        continue;
      }

      const existingUser = await input.repository.getUserByClerkUserId(
        identity.clerkUserId,
      );

      if (existingUser?.deletedAt) {
        summary.usersSkippedDeleted += 1;
        continue;
      }

      await input.repository.upsertUserFromWebhook(identity);
      summary.usersSynced += 1;
    }

    if (page.users.length < pageSize) {
      break;
    }
  }

  input.logger?.info(
    `Clerk backfill synced ${summary.usersSynced} user(s) across ${summary.pagesProcessed} page(s)`,
  );

  return summary;
}

class PostgresAppRepository implements AppRepository {
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

  async upsertUserFromWebhook(identity: AuthIdentity): Promise<AppBootstrap> {
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
          metadataJson: existingEvent.metadataJson
        };
      }
    }

    const limit = 10;

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

    if (used + reserved >= limit) {
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

  async finalizeAiAction(eventId: string, metadataJson?: Record<string, unknown>): Promise<void> {
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
        ...(metadataJson ? { metadataJson } : {}) 
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

async function getAuthenticatedClerkUserId(
  requestContext: object,
): Promise<string | null> {
  const auth = getAuth(requestContext as never);
  return auth.userId ?? null;
}

export function createProductionAppContext(): AppContext {
  return {
    authMiddleware: clerkMiddleware(),
    getAuthenticatedClerkUserId,
    verifyWebhook(request) {
      return verifyWebhook(request);
    },
    repository: new PostgresAppRepository(),
    logger: createLogger("api"),
    aiService: new AiService(new FakeAiProvider()),
    async getUsage(user) {
      const period = getCurrentBillingPeriod();
      const limit = user.planCode === "free" ? 10 : 10;

      const db = createDatabase();
      const counters = (
        await db
          .select()
          .from(monthlyUsageCounters)
          .where(
            and(
              eq(monthlyUsageCounters.userId, user.id),
              eq(monthlyUsageCounters.period, period),
            ),
          )
          .limit(1)
      )[0];
      const used = counters?.aiActionsUsed ?? 0;

      const reservedRecord = (
        await db
          .select()
          .from(aiActionsReserved)
          .where(
            and(
              eq(aiActionsReserved.userId, user.id),
              eq(aiActionsReserved.period, period),
            ),
          )
          .limit(1)
      )[0];
      const reserved = reservedRecord?.aiActionsReserved ?? 0;

      const remaining = Math.max(0, limit - (used + reserved));

      return {
        period,
        aiActionsUsed: used,
        aiActionsReserved: reserved,
        aiActionsRemaining: remaining,
        exportsRemaining: 3,
        sourceUploadsRemaining: 0,
      };
    },
  };
}
