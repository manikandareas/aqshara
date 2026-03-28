import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { ProvisioningPending } from "@/features/onboarding/components/provisioning-pending"
import { resolveOnboardingRedirect } from "@/features/onboarding/lib/onboarding"
import { appSessionQueryOptions, isApiRequestErrorStatus } from "@/features/onboarding/queries/onboarding-queries"
import { AppShell } from "@/features/workspace/components/app-shell"

export const Route = createFileRoute("/app")({
  loader: async ({ context, location }) => {
    try {
      const session = await context.queryClient.ensureQueryData(appSessionQueryOptions())

      if (!session) {
        return null
      }

      const nextLocation = resolveOnboardingRedirect(location.pathname, session)
      if (nextLocation) {
        throw redirect({ to: nextLocation })
      }

      return null
    } catch (error) {
      if (isApiRequestErrorStatus(error, 401)) {
        throw redirect({ to: "/sign-in" })
      }

      throw error
    }
  },
  component: AppPage,
})

function AppPage() {
  const { data: session } = useSuspenseQuery(appSessionQueryOptions())

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-xl">
          <ProvisioningPending />
        </div>
      </div>
    )
  }

  return <AppShell />
}
