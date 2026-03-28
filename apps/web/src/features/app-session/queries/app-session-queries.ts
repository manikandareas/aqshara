import { queryOptions } from "@tanstack/react-query"

import {
  apiGet,
  requireApiData,
  toApiRequestError,
} from "@/lib/api-client"

import type { SessionBootstrap } from "../lib/app-session"

export const appSessionQueryKey = ["app-session"] as const

export const appSessionQueryOptions = () =>
  queryOptions({
    queryKey: appSessionQueryKey,
    queryFn: async (): Promise<SessionBootstrap | null> => {
      const result = await apiGet<SessionBootstrap>("/v1/me")

      if (result.error) {
        if (result.response.status === 409) {
          return null
        }

        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load your app session."
        )
      }

      return requireApiData(result.data, "Missing app session response.")
    },
    refetchInterval: (query) => (query.state.data === null ? 3_000 : false),
    staleTime: 30_000,
  })
