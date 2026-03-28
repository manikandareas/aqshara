import { queryOptions } from "@tanstack/react-query"

import { apiGet, requireApiData, toApiRequestError } from "@/lib/api-client"

export const healthQueryKey = ["system", "health"] as const
export const readinessQueryKey = ["system", "readiness"] as const

export const healthQueryOptions = () =>
  queryOptions({
    queryKey: healthQueryKey,
    queryFn: async () => {
      const result = await apiGet("/health")

      if (result.error) {
        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load API health."
        )
      }

      return requireApiData(result.data, "Missing health response.")
    },
  })

export const readinessQueryOptions = () =>
  queryOptions({
    queryKey: readinessQueryKey,
    queryFn: async () => {
      const result = await apiGet("/v1/system/readiness")

      if (result.error) {
        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load API readiness."
        )
      }

      return requireApiData(result.data, "Missing readiness response.")
    },
  })
