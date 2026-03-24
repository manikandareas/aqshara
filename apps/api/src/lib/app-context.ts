import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { WebhookEvent } from "@clerk/backend/webhooks";
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { DocumentAst } from "@aqshara/documents";
import {
  createDatabase,
  documents,
  users,
  workspaces,
} from "@aqshara/database";
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { Logger } from "./logger.js";
import { createLogger } from "./logger.js";

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
  contentJson: DocumentAst;
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
  aiActionsRemaining: number;
  exportsRemaining: number;
  sourceUploadsRemaining: number;
};

export type DocumentListOptions = {
  userId: string;
  status: DocumentStatus;
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
    contentJson: DocumentAst;
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
  getUsage: (user: AppUser) => AppUsage;
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
    contentJson: row.contentJson as DocumentAst,
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
        contentJson: {
          version: 1,
          nodes: [],
        },
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
    contentJson: DocumentAst;
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
    getUsage(user) {
      return user.planCode === "free"
        ? {
            aiActionsRemaining: 10,
            exportsRemaining: 3,
            sourceUploadsRemaining: 0,
          }
        : {
            aiActionsRemaining: 10,
            exportsRemaining: 3,
            sourceUploadsRemaining: 0,
          };
    },
  };
}
