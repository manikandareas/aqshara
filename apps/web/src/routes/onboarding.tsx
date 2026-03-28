import * as React from "react"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import {
  appSessionQueryKey,
  appSessionQueryOptions,
} from "@/features/app-session/queries/app-session-queries"
import {
  bootstrapFirstDocument,
  templatesQueryOptions,
} from "@/features/documents/queries/documents-queries"
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form"
import { ProvisioningPending } from "@/features/onboarding/components/provisioning-pending"
import { resolveOnboardingRedirect } from "@/features/onboarding/lib/onboarding"
import { getApiErrorMessage, isApiRequestErrorStatus } from "@/lib/api-client"

export const Route = createFileRoute("/onboarding")({
  loader: async ({ context, location }) => {
    try {
      const session = await context.queryClient.ensureQueryData(appSessionQueryOptions())

      if (session) {
        const nextLocation = resolveOnboardingRedirect(location.pathname, session)

        if (nextLocation) {
          throw redirect({ to: nextLocation })
        }
      }

      await context.queryClient.ensureQueryData(templatesQueryOptions())
      return null
    } catch (error) {
      if (isApiRequestErrorStatus(error, 401)) {
        throw redirect({ to: "/sign-in" })
      }

      throw error
    }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const navigate = useNavigate({ from: "/onboarding" })
  const queryClient = useQueryClient()
  const { data: session } = useSuspenseQuery(appSessionQueryOptions())
  const { data: templates } = useSuspenseQuery(templatesQueryOptions())

  const mutation = useMutation({
    mutationFn: bootstrapFirstDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: appSessionQueryKey })
      const nextSession = await queryClient.ensureQueryData(appSessionQueryOptions())
      const nextLocation = nextSession
        ? resolveOnboardingRedirect("/onboarding", nextSession) ?? "/app"
        : "/onboarding"

      await navigate({ to: nextLocation })
    },
    onError: async (error) => {
      if (isApiRequestErrorStatus(error, 401)) {
        await navigate({ to: "/sign-in" })
      }
    },
  })

  const errorMessage = React.useMemo(() => {
    if (!mutation.error) {
      return undefined
    }

    return getApiErrorMessage(mutation.error)
  }, [mutation.error])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center gap-10 px-6 py-12 lg:px-10">
        <div className="hidden flex-1 lg:block">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex rounded-full border border-border/70 bg-muted/40 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Aqshara onboarding
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                Enter the existing workspace with a real first draft.
              </h1>
              <p className="max-w-lg text-base leading-7 text-muted-foreground">
                The onboarding route stays aligned with the current app shell:
                same neutral tokens, same dense editor aesthetic, and the same
                document-first workflow that future features will extend.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-2xl flex-1">
          {session ? (
            <OnboardingForm
              session={session}
              templates={templates}
              isPending={mutation.isPending}
              errorMessage={errorMessage}
              onSubmit={mutation.mutateAsync}
            />
          ) : (
            <ProvisioningPending />
          )}
        </div>
      </div>
    </div>
  )
}
