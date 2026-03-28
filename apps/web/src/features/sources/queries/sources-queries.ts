import { queryOptions } from "@tanstack/react-query"

import type { ApiRequestBody } from "@/lib/api-schema"
import {
  apiDelete,
  apiGet,
  apiPost,
  requireApiData,
  toApiRequestError,
} from "@/lib/api-client"

export type CreateSourceUploadUrlInput = ApiRequestBody<"/v1/sources/upload-url", "post">
export type RegisterSourceInput = ApiRequestBody<"/v1/sources/register", "post">
export type RetrySourceInput = ApiRequestBody<"/v1/sources/{sourceId}/retry", "post">

export function documentSourcesQueryKey(documentId: string) {
  return ["sources", "document", documentId] as const
}

export function sourceStatusQueryKey(sourceId: string) {
  return ["sources", "status", sourceId] as const
}

export const documentSourcesQueryOptions = (documentId: string) =>
  queryOptions({
    queryKey: documentSourcesQueryKey(documentId),
    queryFn: async () => {
      const result = await apiGet("/v1/documents/{documentId}/sources", {
        params: {
          path: {
            documentId,
          },
        },
      })

      if (result.error) {
        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load document sources."
        )
      }

      return requireApiData(result.data, "Missing document sources response.")
    },
  })

export const sourceStatusQueryOptions = (sourceId: string) =>
  queryOptions({
    queryKey: sourceStatusQueryKey(sourceId),
    queryFn: async () => {
      const result = await apiGet("/v1/sources/{sourceId}/status", {
        params: {
          path: {
            sourceId,
          },
        },
      })

      if (result.error) {
        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load source status."
        )
      }

      return requireApiData(result.data, "Missing source status response.")
    },
  })

export async function createSourceUploadUrl(input: CreateSourceUploadUrlInput = {}) {
  const result = await apiPost("/v1/sources/upload-url", {
    headers: {
      "content-type": "application/json",
    },
    body: input,
  })

  if (result.error) {
    throw toApiRequestError(
      result.response.status,
      result.error,
      "Failed to create a source upload target."
    )
  }

  return requireApiData(result.data, "Missing source upload URL response.")
}

export async function registerSource(input: RegisterSourceInput) {
  const result = await apiPost("/v1/sources/register", {
    headers: {
      "content-type": "application/json",
    },
    body: input,
  })

  if (result.error) {
    throw toApiRequestError(
      result.response.status,
      result.error,
      "Failed to register the source."
    )
  }

  return requireApiData(result.data, "Missing register source response.")
}

export async function retrySource(sourceId: string, input: RetrySourceInput = {}) {
  const result = await apiPost("/v1/sources/{sourceId}/retry", {
    params: {
      path: {
        sourceId,
      },
    },
    headers: {
      "content-type": "application/json",
    },
    body: input,
  })

  if (result.error) {
    throw toApiRequestError(
      result.response.status,
      result.error,
      "Failed to retry the source."
    )
  }

  return requireApiData(result.data, "Missing retry source response.")
}

export async function deleteSource(sourceId: string) {
  const result = await apiDelete("/v1/sources/{sourceId}", {
    params: {
      path: {
        sourceId,
      },
    },
  })

  if (result.error) {
    throw toApiRequestError(
      result.response.status,
      result.error,
      "Failed to delete the source."
    )
  }
}
