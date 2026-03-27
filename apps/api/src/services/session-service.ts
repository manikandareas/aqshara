import type { AppBootstrap, AppUser } from "../repositories/app-repository.types.js";
import type { AppRepository } from "../repositories/app-repository.types.js";
import type { AppUsage } from "../lib/api-types.js";

export type SessionMePayload = {
  user: AppUser;
  workspace: AppBootstrap["workspace"];
  plan: { code: AppUser["planCode"]; label: "Free" | "Pro" };
  usage: AppUsage;
  documentStats: { activeCount: number; archivedCount: number };
  onboarding: {
    shouldShow: boolean;
    reason: "zero_documents" | "has_documents";
  };
};

export class SessionService {
  constructor(
    private readonly repository: AppRepository,
    private readonly getUsage: (user: AppUser) => Promise<AppUsage>,
  ) {}

  async getSessionPayload(bootstrap: AppBootstrap): Promise<SessionMePayload> {
    const [usage, activeCount, archivedCount] = await Promise.all([
      this.getUsage(bootstrap.user),
      this.repository.countActiveDocuments(bootstrap.user.id),
      this.repository.countArchivedDocuments(bootstrap.user.id),
    ]);

    const totalDocuments = activeCount + archivedCount;
    const hasDocuments = totalDocuments > 0;

    return {
      user: bootstrap.user,
      workspace: bootstrap.workspace,
      plan: {
        code: bootstrap.user.planCode,
        label: bootstrap.user.planCode === "pro" ? "Pro" : "Free",
      },
      usage,
      documentStats: {
        activeCount,
        archivedCount,
      },
      onboarding: {
        shouldShow: !hasDocuments,
        reason: hasDocuments ? "has_documents" : "zero_documents",
      },
    };
  }

  getUsageForUser(user: AppUser): Promise<AppUsage> {
    return this.getUsage(user);
  }
}
