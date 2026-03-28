import { queryOptions } from "@tanstack/react-query"

import type { ApiQueryParams, ApiRequestBody } from "@/lib/api-schema"
import {
  apiGet,
  apiPost,
  requireApiData,
  toApiRequestError,
} from "@/lib/api-client"

export type ExportsListFilters = ApiQueryParams<"/v1/exports", "get">
export type CreateDocxExportInput = ApiRequestBody<
  "/v1/documents/{documentId}/exports/docx",
  "post"
>

export function exportsListQueryKey(filters: ExportsListFilters = {}) {
  return ["exports", "list", filters] as const
}

export function exportDetailQueryKey(exportId: string) {
  return ["exports", "detail", exportId] as const
}

export const exportsListQueryOptions = (filters: ExportsListFilters = {}) =>
  queryOptions({
    queryKey: exportsListQueryKey(filters),
    queryFn: async () => {
      const result = await apiGet("/v1/exports", {
        params: {
          query: filters,
        },
      })

      if (result.error) {
        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load exports."
        )
      }

      return requireApiData(result.data, "Missing exports response.")
    },
  })

export const exportDetailQueryOptions = (exportId: string) =>
  queryOptions({
    queryKey: exportDetailQueryKey(exportId),
    queryFn: async () => {
      const result = await apiGet("/v1/exports/{exportId}", {
        params: {
          path: {
            exportId,
          },
        },
      })

      if (result.error) {
        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load export details."
        )
      }

      return requireApiData(result.data, "Missing export detail response.")
    },
  })

export async function preflightDocxExport(documentId: string) {
  const result = await apiPost("/v1/documents/{documentId}/exports/docx/preflight", {
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
      "Failed to preflight the DOCX export."
    )
  }

  return requireApiData(result.data, "Missing export preflight response.")
}

export async function createDocxExport(
  documentId: string,
  input: CreateDocxExportInput
) {
  const result = await apiPost("/v1/documents/{documentId}/exports/docx", {
    params: {
      path: {
        documentId,
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
      "Failed to create the DOCX export."
    )
  }

  return requireApiData(result.data, "Missing create export response.")
}

export async function retryExport(exportId: string) {
  const result = await apiPost("/v1/exports/{exportId}/retry", {
    params: {
      path: {
        exportId,
      },
    },
  })

  if (result.error) {
    throw toApiRequestError(
      result.response.status,
      result.error,
      "Failed to retry the export."
    )
  }

  return requireApiData(result.data, "Missing retry export response.")
}

export async function downloadExport(exportId: string) {
  const result = await apiGet("/v1/exports/{exportId}/download", {
    params: {
      path: {
        exportId,
      },
    },
  })

  if (result.error) {
    throw toApiRequestError(
      result.response.status,
      result.error,
      "Failed to prepare the export download."
    )
  }

  return {
    redirectUrl: result.response.headers.get("location"),
    data: result.data,
    response: result.response,
  }
}
