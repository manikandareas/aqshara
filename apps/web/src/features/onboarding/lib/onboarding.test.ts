import { describe, expect, it } from "vitest"

import {
  resolveOnboardingRedirect,
  type SessionBootstrap,
} from "./onboarding"

const baseSession: SessionBootstrap = {
  user: {
    id: "user_1",
    clerkUserId: "clerk_1",
    email: "user@example.com",
    name: "Aqshara User",
    avatarUrl: null,
    planCode: "free",
  },
  workspace: {
    id: "workspace_1",
    userId: "user_1",
    name: "My Workspace",
  },
  plan: {
    code: "free",
    label: "Free",
  },
  usage: {
    period: "2026-03",
    aiActionsUsed: 0,
    aiActionsReserved: 0,
    aiActionsRemaining: 10,
    exportsRemaining: 3,
    sourceUploadsRemaining: 3,
  },
  documentStats: {
    activeCount: 0,
    archivedCount: 0,
  },
  onboarding: {
    shouldShow: true,
    reason: "zero_documents",
  },
}

describe("resolveOnboardingRedirect", () => {
  it("redirects /app visitors into onboarding when onboarding is required", () => {
    expect(resolveOnboardingRedirect("/app", baseSession)).toBe("/onboarding")
  })

  it("redirects /onboarding visitors back to /app when onboarding is complete", () => {
    expect(
      resolveOnboardingRedirect("/onboarding", {
        ...baseSession,
        onboarding: {
          shouldShow: false,
          reason: "has_documents",
        },
      })
    ).toBe("/app")
  })

  it("does not redirect when the current location already matches the required experience", () => {
    expect(resolveOnboardingRedirect("/onboarding", baseSession)).toBeNull()
    expect(
      resolveOnboardingRedirect("/app", {
        ...baseSession,
        onboarding: {
          shouldShow: false,
          reason: "has_documents",
        },
      })
    ).toBeNull()
  })
})
