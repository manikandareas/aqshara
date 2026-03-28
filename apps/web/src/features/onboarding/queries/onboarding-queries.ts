import { createApiClient } from "@aqshara/api-client"
import { getAuthHeader } from "@aqshara/auth"
import { queryOptions } from "@tanstack/react-query"

import type {
  BootstrapDocumentInput,
  SessionBootstrap,
  TemplateCode,
} from "../lib/onboarding"

type ApiErrorPayload = {
  code?: string
  message?: string
  requestId?: string
}

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: () => Promise<string | null>
      }
    }
  }
}

export class ApiRequestError extends Error {
  status: number
  code: string | null
  requestId: string | null

  constructor(
    status: number,
    message: string,
    code?: string | null,
    requestId?: string | null
  ) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = code ?? null
    this.requestId = requestId ?? null
  }
}

export const appSessionQueryKey = ["app-session"] as const
export const onboardingTemplatesQueryKey = ["onboarding-templates"] as const

async function getClerkToken() {
  if (typeof window !== "undefined") {
    return (await window.Clerk?.session?.getToken()) ?? null
  }

  const { auth } = await import("@clerk/tanstack-react-start/server")
  const serverAuth = auth() as {
    getToken?: () => Promise<string | null> | string | null
  }

  if (!serverAuth.getToken) {
    return null
  }

  return await serverAuth.getToken()
}

async function getAuthHeaders() {
  const token = await getClerkToken()
  return token ? getAuthHeader(token) : {}
}

function toApiRequestError(
  status: number,
  payload: ApiErrorPayload | undefined,
  fallbackMessage: string
) {
  return new ApiRequestError(
    status,
    payload?.message ?? fallbackMessage,
    payload?.code,
    payload?.requestId
  )
}

export function isApiRequestErrorStatus(error: unknown, status: number) {
  return error instanceof ApiRequestError && error.status === status
}

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again."
) {
  if (error instanceof ApiRequestError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

export const appSessionQueryOptions = () =>
  queryOptions({
    queryKey: appSessionQueryKey,
    queryFn: async (): Promise<SessionBootstrap | null> => {
      const client = createApiClient()
      const { data, error, response } = await client.GET("/v1/me", {
        headers: await getAuthHeaders(),
      })

      if (error) {
        if (response.status === 409) {
          return null
        }

        throw toApiRequestError(
          response.status,
          error as ApiErrorPayload,
          "Failed to load your app session."
        )
      }

      if (!data) {
        throw new ApiRequestError(500, "Missing app session response.")
      }

      return data
    },
    refetchInterval: (query) => (query.state.data === null ? 3_000 : false),
    staleTime: 30_000,
  })

export const onboardingTemplatesQueryOptions = () =>
  queryOptions({
    queryKey: onboardingTemplatesQueryKey,
    queryFn: async (): Promise<TemplateCode[]> => {
      const client = createApiClient()
      const { data, error, response } = await client.GET("/v1/templates", {
        headers: await getAuthHeaders(),
      })

      if (error) {
        if (response.status === 409) {
          return []
        }

        throw toApiRequestError(
          response.status,
          error as ApiErrorPayload,
          "Failed to load onboarding templates."
        )
      }

      return (data?.templates ?? []) as TemplateCode[]
    },
    staleTime: 5 * 60_000,
  })

export async function bootstrapFirstDocument(input: BootstrapDocumentInput) {
  const client = createApiClient()
  const { data, error, response } = await client.POST("/v1/documents/bootstrap", {
    headers: {
      "content-type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: input,
  })

  if (error) {
    throw toApiRequestError(
      response.status,
      error as ApiErrorPayload,
      "Failed to create your first document."
    )
  }

  return data?.document ?? null
}
