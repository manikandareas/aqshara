import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { WebhookEvent } from "@clerk/backend/webhooks";
import { verifyWebhook } from "@clerk/backend/webhooks";
import {
  createDatabase,
  monthlyUsageCounters,
  aiActionsReserved,
} from "@aqshara/database";
import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { createLogger } from "./logger.js";
import type { Logger } from "./logger.js";

import type { AiService } from "./ai/service.js";
import { createAiServiceForEnv } from "./ai/factory.js";
import { getCurrentBillingPeriod } from "../repositories/billing-period.js";
import { PostgresAppRepository } from "../repositories/postgres-app-repository.js";
import type {
  AppRepository,
  AppUser,
} from "../repositories/app-repository.types.js";
import { createApiServices, type ApiServices } from "../services/index.js";
import type { AppUsage } from "./api-types.js";
import {
  toProvisioningIdentity,
  type ClerkProvisioningUser,
  type ClerkUserEmailAddress,
} from "./clerk-provisioning.js";

export type {
  PlanCode,
  DocumentType,
  DocumentStatus,
  AuthIdentity,
  AppUser,
  Workspace,
  AppDocument,
  AppBootstrap,
  DocumentListOptions,
  AppDocumentChangeProposal,
  DocumentPatch,
  AppRepository,
} from "../repositories/app-repository.types.js";

export { StaleDocumentSaveError } from "../repositories/app-repository.types.js";

export { getCurrentBillingPeriod } from "../repositories/billing-period.js";

export type { AppUsage };

export type { ClerkUserEmailAddress, ClerkProvisioningUser };

export { toProvisioningIdentity };

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
  services: ApiServices;
};

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

async function getAuthenticatedClerkUserId(
  requestContext: object,
): Promise<string | null> {
  const auth = getAuth(requestContext as never);
  return auth.userId ?? null;
}

export function createProductionAppContext(): AppContext {
  const repository = new PostgresAppRepository();
  const logger = createLogger("api");
  const aiService = createAiServiceForEnv(logger);

  const getUsage = async (user: AppUser) => {
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
  };

  const services = createApiServices({
    repository,
    aiService,
    getUsage,
  });

  return {
    authMiddleware: clerkMiddleware(),
    getAuthenticatedClerkUserId,
    verifyWebhook(request) {
      return verifyWebhook(request);
    },
    repository,
    logger,
    aiService,
    getUsage,
    services,
  };
}
