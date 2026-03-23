import { randomUUID } from "node:crypto";
import type { DocumentAst } from "@aqshara/documents";
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
} from "../lib/app-context.js";
import { createLogger } from "../lib/logger.js";

type MemoryState = {
  users: AppUser[];
  workspaces: Workspace[];
  documents: AppDocument[];
};

class MemoryRepository implements AppRepository {
  private readonly state: MemoryState = {
    users: [],
    workspaces: [],
    documents: [],
  };

  async getUserByClerkUserId(clerkUserId: string): Promise<AppUser | null> {
    return this.state.users.find((entry) => entry.clerkUserId === clerkUserId) ?? null;
  }

  async getWorkspaceForUser(userId: string): Promise<Workspace | null> {
    return this.state.workspaces.find((entry) => entry.userId === userId) ?? null;
  }

  async upsertUserFromWebhook(identity: AuthIdentity): Promise<AppBootstrap> {
    let user = this.state.users.find((entry) => entry.clerkUserId === identity.clerkUserId);

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

    let workspace = this.state.workspaces.find((entry) => entry.userId === user.id);

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

  async softDeleteUserByClerkUserId(clerkUserId: string): Promise<AppUser | null> {
    const user = this.state.users.find((entry) => entry.clerkUserId === clerkUserId);

    if (!user) {
      return null;
    }

    user.deletedAt = new Date().toISOString();
    return user;
  }

  async listDocuments(options: DocumentListOptions): Promise<AppDocument[]> {
    const workspace = this.state.workspaces.find((entry) => entry.userId === options.userId);

    if (!workspace) {
      return [];
    }

    return this.state.documents
      .filter((entry) => entry.workspaceId === workspace.id)
      .filter((entry) =>
        options.status === "archived" ? Boolean(entry.archivedAt) : !entry.archivedAt,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createDocument(input: {
    userId: string;
    title: string;
    type: DocumentType;
  }): Promise<AppDocument> {
    const workspace = this.state.workspaces.find((entry) => entry.userId === input.userId);

    if (!workspace) {
      throw new Error("Workspace not found for user");
    }

    const now = new Date().toISOString();
    const document: AppDocument = {
      id: randomUUID(),
      workspaceId: workspace.id,
      title: input.title,
      type: input.type,
      contentJson: {
        version: 1,
        nodes: [],
      },
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
    const workspace = this.state.workspaces.find((entry) => entry.userId === input.userId);

    if (!workspace) {
      return null;
    }

    return (
      this.state.documents.find(
        (entry) => entry.workspaceId === workspace.id && entry.id === input.documentId,
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
    contentJson: DocumentAst;
    plainText: string;
  }): Promise<AppDocument | null> {
    const document = await this.getDocumentById(input);

    if (!document) {
      return null;
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

  async deleteDocument(input: {
    userId: string;
    documentId: string;
  }): Promise<boolean> {
    const document = await this.getDocumentById(input);

    if (!document) {
      return false;
    }

    this.state.documents = this.state.documents.filter((entry) => entry.id !== input.documentId);
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
      return (await request.json()) as WebhookEvent;
    },
    repository,
    logger: createLogger("api:test"),
    getUsage() {
      return {
        aiActionsRemaining: 10,
        exportsRemaining: 3,
        sourceUploadsRemaining: 0,
      };
    },
  };
}
