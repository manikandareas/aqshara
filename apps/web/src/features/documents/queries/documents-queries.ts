import { queryOptions } from "@tanstack/react-query"

import type { ApiQueryParams, ApiRequestBody } from "@/lib/api-schema"
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  requireApiData,
  toApiRequestError,
} from "@/lib/api-client"

import type { BootstrapDocumentInput, TemplateCode } from "../lib/documents"

export type DocumentsListFilters = ApiQueryParams<"/v1/documents", "get">
export type RecentDocumentsFilters = ApiQueryParams<"/v1/documents/recent", "get">
export type CreateDocumentInput = ApiRequestBody<"/v1/documents", "post">
export type UpdateDocumentInput = ApiRequestBody<"/v1/documents/{documentId}", "patch">
export type SaveDocumentContentInput = ApiRequestBody<
  "/v1/documents/{documentId}/content",
  "put"
>
export type GenerateOutlineInput = ApiRequestBody<
  "/v1/documents/{documentId}/outline/generate",
  "post"
>
export type ApplyOutlineInput = ApiRequestBody<
  "/v1/documents/{documentId}/outline/apply",
  "post"
>
export type GenerateProposalInput = ApiRequestBody<
  "/v1/documents/{documentId}/ai/proposals",
  "post"
>

export const templatesQueryKey = ["documents", "templates"] as const
export const bootstrapDocumentMutationKey = ["documents", "bootstrap"] as const

export function documentsListQueryKey(filters: DocumentsListFilters = {}) {
  return ["documents", "list", filters] as const
}

export function recentDocumentsQueryKey(filters: RecentDocumentsFilters = {}) {
  return ["documents", "recent", filters] as const
}

export function documentDetailQueryKey(documentId: string) {
  return ["documents", "detail", documentId] as const
}

export function documentVersionsQueryKey(documentId: string) {
  return ["documents", "versions", documentId] as const
}

export const templatesQueryOptions = () =>
  queryOptions({
    queryKey: templatesQueryKey,
    queryFn: async (): Promise<TemplateCode[]> => {
      const result = await apiGet<{ templates: TemplateCode[] }>("/v1/templates")

      if (result.error) {
        if (result.response.status === 409) {
          return []
        }

        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load document templates."
        )
      }

      return result.data?.templates ?? []
    },
    staleTime: 5 * 60_000,
  })

export const documentsListQueryOptions = (filters: DocumentsListFilters = {}) =>
  queryOptions({
    queryKey: documentsListQueryKey(filters),
    queryFn: async () => {
      const result = await apiGet("/v1/documents", {
        params: {
          query: filters,
        },
      })

      if (result.error) {
        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load documents."
        )
      }

      return requireApiData(result.data, "Missing documents response.")
    },
  })

export const recentDocumentsQueryOptions = (filters: RecentDocumentsFilters = {}) =>
  queryOptions({
    queryKey: recentDocumentsQueryKey(filters),
    queryFn: async () => {
      const result = await apiGet("/v1/documents/recent", {
        params: {
          query: filters,
        },
      })

      if (result.error) {
        throw toApiRequestError(
          result.response.status,
          result.error,
          "Failed to load recent documents."
        )
      }

      return requireApiData(result.data, "Missing recent documents response.")
    },
  })

export const documentDetailQueryOptions = (documentId: string) =>
  queryOptions({
    queryKey: documentDetailQueryKey(documentId),
    queryFn: async () => {
      const result = await apiGet("/v1/documents/{documentId}", {
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
          "Failed to load the document."
        )
      }

      return requireApiData(result.data, "Missing document response.")
    },
  })

export const documentVersionsQueryOptions = (documentId: string) =>
  queryOptions({
    queryKey: documentVersionsQueryKey(documentId),
    queryFn: async () => {
      const result = await apiGet("/v1/documents/{documentId}/versions", {
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
          "Failed to load document versions."
        )
      }

      return requireApiData(result.data, "Missing document versions response.")
    },
  })

export async function bootstrapFirstDocument(input: BootstrapDocumentInput) {
  const result = await apiPost("/v1/documents/bootstrap", {
    headers: {
      "content-type": "application/json",
    },
    body: input,
  })

  if (result.error) {
    throw toApiRequestError(
      result.response.status,
      result.error,
      "Failed to create your first document."
    )
  }

  return requireApiData(result.data, "Missing bootstrap document response.")
}

export async function createDocument(input: CreateDocumentInput) {
  const result = await apiPost("/v1/documents", {
    headers: {
      "content-type": "application/json",
    },
    body: input,
  })

  if (result.error) {
    throw toApiRequestError(
      result.response.status,
      result.error,
      "Failed to create the document."
    )
  }

  return requireApiData(result.data, "Missing create document response.")
}

export async function updateDocument(documentId: string, input: UpdateDocumentInput) {
  const result = await apiPatch("/v1/documents/{documentId}", {
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
      "Failed to update the document."
    )
  }

  return requireApiData(result.data, "Missing update document response.")
}

export async function saveDocumentContent(
  documentId: string,
  input: SaveDocumentContentInput
) {
  const result = await apiPut("/v1/documents/{documentId}/content", {
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
      "Failed to save the document."
    )
  }

  return requireApiData(result.data, "Missing save document response.")
}

export async function archiveDocument(documentId: string) {
  const result = await apiPost("/v1/documents/{documentId}/archive", {
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
      "Failed to archive the document."
    )
  }

  return requireApiData(result.data, "Missing archive document response.")
}

export async function deleteDocument(documentId: string) {
  const result = await apiDelete("/v1/documents/{documentId}", {
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
      "Failed to delete the document."
    )
  }
}

export async function generateDocumentOutline(
  documentId: string,
  input: GenerateOutlineInput
) {
  const result = await apiPost("/v1/documents/{documentId}/outline/generate", {
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
      "Failed to generate the outline."
    )
  }

  return requireApiData(result.data, "Missing outline generation response.")
}

export async function applyDocumentOutline(
  documentId: string,
  input: ApplyOutlineInput
) {
  const result = await apiPost("/v1/documents/{documentId}/outline/apply", {
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
      "Failed to apply the generated outline."
    )
  }

  return requireApiData(result.data, "Missing apply outline response.")
}

export async function generateDocumentProposal(
  documentId: string,
  input: GenerateProposalInput
) {
  const result = await apiPost("/v1/documents/{documentId}/ai/proposals", {
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
      "Failed to generate a document proposal."
    )
  }

  return requireApiData(result.data, "Missing proposal generation response.")
}
