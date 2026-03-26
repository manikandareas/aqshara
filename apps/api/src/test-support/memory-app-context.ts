import { randomUUID } from "node:crypto";
import type {
  DocumentValue,
  DocumentChangeProposal,
  TemplateCode,
} from "@aqshara/documents";
import { createTemplateDocument, toPlainText } from "@aqshara/documents";
import type { WebhookEvent } from "@clerk/backend/webhooks";
import type {
  AppBootstrap,
  AppContext,
  AppDocument,
  AppRepository,
  AppUser,
  AuthIdentity,
  DocumentListOptions,
  DocumentPatch,
  DocumentType,
  Workspace,
  AppDocumentChangeProposal,
} from "../lib/app-context.js";
import { getCurrentBillingPeriod } from "../lib/app-context.js";
import { StaleDocumentSaveError } from "../lib/app-context.js";
import { createLogger } from "../lib/logger.js";
import { AiService, FakeAiProvider } from "../lib/ai/index.js";

type UsageEvent = {
  id: string;
  userId: string;
  documentId: string | null;
  billingPeriod: string;
  featureKey: string;
  eventType: string;
  status: string;
  idempotencyKey: string | null;
  requestHash: string | null;
  completedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  metadataJson?: Record<string, unknown>;
};

type MonthlyUsageCounter = {
  id: string;
  userId: string;
  period: string;
  aiActionsUsed: number;
  sourceUploadsUsed: number;
  exportsUsed: number;
  storageUsedBytes: number;
  updatedAt: string;
};

type AiActionReserved = {
  id: string;
  userId: string;
  period: string;
  aiActionsReserved: number;
  updatedAt: string;
};

type MemoryState = {
  users: AppUser[];
  workspaces: Workspace[];
  documents: AppDocument[];
  usageEvents: UsageEvent[];
  monthlyUsageCounters: MonthlyUsageCounter[];
  aiActionsReserved: AiActionReserved[];
  documentChangeProposals: AppDocumentChangeProposal[];
};

class MemoryRepository implements AppRepository {
  public readonly state: MemoryState = {
    users: [],
    workspaces: [],
    documents: [],
    usageEvents: [],
    monthlyUsageCounters: [],
    aiActionsReserved: [],
    documentChangeProposals: [],
  };

  async getUserByClerkUserId(clerkUserId: string): Promise<AppUser | null> {
    return (
      this.state.users.find((entry) => entry.clerkUserId === clerkUserId) ??
      null
    );
  }

  async getWorkspaceForUser(userId: string): Promise<Workspace | null> {
    return (
      this.state.workspaces.find((entry) => entry.userId === userId) ?? null
    );
  }

  async upsertUserFromWebhook(identity: AuthIdentity): Promise<AppBootstrap> {
    let user = this.state.users.find(
      (entry) => entry.clerkUserId === identity.clerkUserId,
    );

    if (!user) {
      user = {
        id: randomUUID(),
        clerkUserId: identity.clerkUserId,
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
        planCode: "free",
        deletedAt: null,
      };
      this.state.users.push(user);
    } else {
      user.email = identity.email;
      user.name = identity.name;
      user.avatarUrl = identity.avatarUrl;
      user.deletedAt = null;
    }

    let workspace = this.state.workspaces.find(
      (entry) => entry.userId === user.id,
    );

    if (!workspace) {
      workspace = {
        id: randomUUID(),
        userId: user.id,
        name: "My Workspace",
      };
      this.state.workspaces.push(workspace);
    }

    return { user, workspace };
  }

  async softDeleteUserByClerkUserId(
    clerkUserId: string,
  ): Promise<AppUser | null> {
    const user = this.state.users.find(
      (entry) => entry.clerkUserId === clerkUserId,
    );

    if (!user) {
      return null;
    }

    user.deletedAt = new Date().toISOString();
    return user;
  }

  async listDocuments(options: DocumentListOptions): Promise<AppDocument[]> {
    const workspace = this.state.workspaces.find(
      (entry) => entry.userId === options.userId,
    );

    if (!workspace) {
      return [];
    }

    return this.state.documents
      .filter((entry) => entry.workspaceId === workspace.id)
      .filter((entry) =>
        options.status === "archived"
          ? Boolean(entry.archivedAt)
          : !entry.archivedAt,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async listRecentDocuments(options: {
    userId: string;
    limit: number;
  }): Promise<AppDocument[]> {
    const workspace = this.state.workspaces.find(
      (entry) => entry.userId === options.userId,
    );

    if (!workspace) {
      return [];
    }

    return this.state.documents
      .filter((entry) => entry.workspaceId === workspace.id)
      .filter((entry) => !entry.archivedAt)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, options.limit);
  }

  async createDocument(input: {
    userId: string;
    title: string;
    type: DocumentType;
  }): Promise<AppDocument> {
    const workspace = this.state.workspaces.find(
      (entry) => entry.userId === input.userId,
    );

    if (!workspace) {
      throw new Error("Workspace not found for user");
    }

    const now = new Date().toISOString();
    const document: AppDocument = {
      id: randomUUID(),
      workspaceId: workspace.id,
      title: input.title,
      type: input.type,
      contentJson: [
        { type: "paragraph", id: "root-p", children: [{ text: "" }] },
      ],
      plainText: "",
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.state.documents.unshift(document);
    return document;
  }

  async getDocumentById(input: {
    userId: string;
    documentId: string;
  }): Promise<AppDocument | null> {
    const workspace = this.state.workspaces.find(
      (entry) => entry.userId === input.userId,
    );

    if (!workspace) {
      return null;
    }

    return (
      this.state.documents.find(
        (entry) =>
          entry.workspaceId === workspace.id && entry.id === input.documentId,
      ) ?? null
    );
  }

  async updateDocument(input: {
    userId: string;
    documentId: string;
    patch: DocumentPatch;
  }): Promise<AppDocument | null> {
    const document = await this.getDocumentById(input);

    if (!document) {
      return null;
    }

    document.title = input.patch.title ?? document.title;
    document.type = input.patch.type ?? document.type;
    document.updatedAt = new Date().toISOString();
    return document;
  }

  async updateDocumentContent(input: {
    userId: string;
    documentId: string;
    contentJson: DocumentValue;
    plainText: string;
    baseUpdatedAt: string;
  }): Promise<AppDocument | null> {
    const document = await this.getDocumentById(input);

    if (!document) {
      return null;
    }

    if (
      new Date(document.updatedAt).getTime() >
      new Date(input.baseUpdatedAt).getTime()
    ) {
      throw new StaleDocumentSaveError();
    }

    document.contentJson = input.contentJson;
    document.plainText = input.plainText;
    document.updatedAt = new Date().toISOString();
    return document;
  }

  async archiveDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<AppDocument | null> {
    const document = await this.getDocumentById(input);

    if (!document) {
      return null;
    }

    document.archivedAt = new Date().toISOString();
    document.updatedAt = document.archivedAt;
    return document;
  }

  async countActiveDocuments(userId: string): Promise<number> {
    const workspace = this.state.workspaces.find(
      (entry) => entry.userId === userId,
    );
    if (!workspace) return 0;
    return this.state.documents.filter(
      (entry) => entry.workspaceId === workspace.id && !entry.archivedAt,
    ).length;
  }

  async countArchivedDocuments(userId: string): Promise<number> {
    const workspace = this.state.workspaces.find(
      (entry) => entry.userId === userId,
    );
    if (!workspace) return 0;
    return this.state.documents.filter(
      (entry) =>
        entry.workspaceId === workspace.id && Boolean(entry.archivedAt),
    ).length;
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
      const existing = this.state.usageEvents.find(
        (e) =>
          e.userId === input.userId &&
          e.idempotencyKey === input.idempotencyKey,
      );
      if (existing) {
        if (existing.requestHash !== input.requestHash) {
          return { allowed: false, reason: "idempotency_mismatch" };
        }
        return {
          allowed: true,
          eventId: existing.id,
          isReplay: existing.status === "succeeded",
          metadataJson: existing.metadataJson,
        };
      }
    }

    const limit = 10;

    const counters = this.state.monthlyUsageCounters.find(
      (c) => c.userId === input.userId && c.period === period,
    );
    const used = counters?.aiActionsUsed ?? 0;

    let reservedRecord = this.state.aiActionsReserved.find(
      (r) => r.userId === input.userId && r.period === period,
    );
    const reserved = reservedRecord?.aiActionsReserved ?? 0;

    if (used + reserved >= limit) {
      return { allowed: false, reason: "quota_exceeded" };
    }

    if (reservedRecord) {
      reservedRecord.aiActionsReserved += 1;
      reservedRecord.updatedAt = new Date().toISOString();
    } else {
      reservedRecord = {
        id: randomUUID(),
        userId: input.userId,
        period,
        aiActionsReserved: 1,
        updatedAt: new Date().toISOString(),
      };
      this.state.aiActionsReserved.push(reservedRecord);
    }

    const event = {
      id: randomUUID(),
      userId: input.userId,
      documentId: input.documentId ?? null,
      billingPeriod: period,
      featureKey: input.featureKey,
      eventType: "ai_action",
      status: "reserved",
      idempotencyKey: input.idempotencyKey ?? null,
      requestHash: input.requestHash ?? null,
      completedAt: null,
      releasedAt: null,
      createdAt: new Date().toISOString(),
    };

    this.state.usageEvents.push(event);

    return { allowed: true, eventId: event.id };
  }

  async finalizeAiAction(
    eventId: string,
    metadataJson?: Record<string, unknown>,
  ): Promise<void> {
    const event = this.state.usageEvents.find((e) => e.id === eventId);
    if (!event || event.status !== "reserved") return;

    event.status = "succeeded";
    event.completedAt = new Date().toISOString();
    if (metadataJson) {
      event.metadataJson = metadataJson;
    }

    const period = event.billingPeriod;
    let counters = this.state.monthlyUsageCounters.find(
      (c) => c.userId === event.userId && c.period === period,
    );

    if (counters) {
      counters.aiActionsUsed += 1;
      counters.updatedAt = new Date().toISOString();
    } else {
      counters = {
        id: randomUUID(),
        userId: event.userId,
        period,
        aiActionsUsed: 1,
        sourceUploadsUsed: 0,
        exportsUsed: 0,
        storageUsedBytes: 0,
        updatedAt: new Date().toISOString(),
      };
      this.state.monthlyUsageCounters.push(counters);
    }

    const reservedRecord = this.state.aiActionsReserved.find(
      (r) => r.userId === event.userId && r.period === period,
    );
    if (reservedRecord && reservedRecord.aiActionsReserved > 0) {
      reservedRecord.aiActionsReserved -= 1;
      reservedRecord.updatedAt = new Date().toISOString();
    }
  }

  async releaseAiAction(eventId: string): Promise<void> {
    const event = this.state.usageEvents.find((e) => e.id === eventId);
    if (!event || event.status !== "reserved") return;

    event.status = "released";
    event.releasedAt = new Date().toISOString();

    const period = event.billingPeriod;
    const reservedRecord = this.state.aiActionsReserved.find(
      (r) => r.userId === event.userId && r.period === period,
    );
    if (reservedRecord && reservedRecord.aiActionsReserved > 0) {
      reservedRecord.aiActionsReserved -= 1;
      reservedRecord.updatedAt = new Date().toISOString();
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
    const proposal: AppDocumentChangeProposal = {
      id: randomUUID(),
      documentId: input.documentId,
      userId: input.userId,
      proposalJson: input.proposalJson,
      actionType: input.actionType,
      status: "pending",
      baseUpdatedAt: new Date(input.baseUpdatedAt).toISOString(),
      targetBlockIds: input.targetBlockIds,
      appliedAt: null,
      dismissedAt: null,
      invalidatedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.documentChangeProposals.unshift(proposal);
    return proposal;
  }

  async getDocumentChangeProposal(
    id: string,
  ): Promise<AppDocumentChangeProposal | null> {
    return this.state.documentChangeProposals.find((p) => p.id === id) ?? null;
  }

  async updateDocumentChangeProposalStatus(input: {
    id: string;
    userId: string;
    status: "applied" | "dismissed" | "previewed" | "invalidated";
  }): Promise<AppDocumentChangeProposal | null> {
    const proposal = this.state.documentChangeProposals.find(
      (p) => p.id === input.id && p.userId === input.userId,
    );
    if (!proposal) return null;

    proposal.status = input.status;
    proposal.updatedAt = new Date().toISOString();

    if (input.status === "applied")
      proposal.appliedAt = new Date().toISOString();
    if (input.status === "dismissed")
      proposal.dismissedAt = new Date().toISOString();
    if (input.status === "invalidated")
      proposal.invalidatedAt = new Date().toISOString();

    return proposal;
  }

  async createTemplateDocument(input: {
    userId: string;
    title: string;
    type: DocumentType;
    templateCode: TemplateCode;
  }): Promise<AppDocument> {
    const workspace = this.state.workspaces.find(
      (entry) => entry.userId === input.userId,
    );
    if (!workspace) throw new Error("Workspace not found for user");

    const contentJson = createTemplateDocument(input.templateCode, randomUUID);
    const now = new Date().toISOString();

    const document: AppDocument = {
      id: randomUUID(),
      workspaceId: workspace.id,
      title: input.title,
      type: input.type,
      contentJson,
      plainText: toPlainText(contentJson),
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.state.documents.unshift(document);
    return document;
  }

  async invalidateStaleProposals(input: {
    documentId: string;
    baseRevisionUpdatedAt: string;
  }): Promise<void> {
    const baseTime = new Date(input.baseRevisionUpdatedAt).getTime();

    for (const p of this.state.documentChangeProposals) {
      if (
        p.documentId === input.documentId &&
        (p.status === "pending" || p.status === "previewed")
      ) {
        if (new Date(p.baseUpdatedAt).getTime() < baseTime) {
          p.status = "invalidated";
          p.invalidatedAt = new Date().toISOString();
          p.updatedAt = new Date().toISOString();
        }
      }
    }
  }

  async deleteDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<boolean> {
    const document = await this.getDocumentById(input);

    if (!document) {
      return false;
    }

    this.state.documents = this.state.documents.filter(
      (entry) => entry.id !== input.documentId,
    );
    return true;
  }
}

export function createMemoryAppContext(): AppContext {
  const repository = new MemoryRepository();

  return {
    authMiddleware: async (_c, next) => {
      await next();
    },
    async getAuthenticatedClerkUserId(c) {
      return c.req.header("x-test-user-id") ?? null;
    },
    async verifyWebhook(request) {
      if (request.headers.get("clerk-signature") === "invalid") {
        throw new Error("Webhook verification failed");
      }
      return (await request.json()) as WebhookEvent;
    },
    repository,
    logger: createLogger("api:test"),
    aiService: new AiService(new FakeAiProvider()),
    async getUsage(user) {
      if (!user) {
        return {
          period: getCurrentBillingPeriod(),
          aiActionsUsed: 0,
          aiActionsReserved: 0,
          aiActionsRemaining: 10,
          exportsRemaining: 3,
          sourceUploadsRemaining: 0,
        };
      }
      const period = getCurrentBillingPeriod();
      const limit = user.planCode === "free" ? 10 : 10;

      const counters = repository.state.monthlyUsageCounters.find(
        (c) => c.userId === user.id && c.period === period,
      );
      const used = counters?.aiActionsUsed ?? 0;

      const reservedRecord = repository.state.aiActionsReserved.find(
        (r) => r.userId === user.id && r.period === period,
      );
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
