export type ApiCoverageEntry = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  domain: string
  wrapper: string
  excludeReason?: string
}

type OpenApiPaths = Record<string, Record<string, unknown>>

export const apiCoverageRegistry = [
  {
    method: "GET",
    path: "/v1/me",
    domain: "app-session",
    wrapper: "appSessionQueryOptions",
  },
  {
    method: "GET",
    path: "/v1/documents",
    domain: "documents",
    wrapper: "documentsListQueryOptions",
  },
  {
    method: "POST",
    path: "/v1/documents",
    domain: "documents",
    wrapper: "createDocument",
  },
  {
    method: "GET",
    path: "/v1/documents/recent",
    domain: "documents",
    wrapper: "recentDocumentsQueryOptions",
  },
  {
    method: "GET",
    path: "/v1/documents/{documentId}",
    domain: "documents",
    wrapper: "documentDetailQueryOptions",
  },
  {
    method: "PATCH",
    path: "/v1/documents/{documentId}",
    domain: "documents",
    wrapper: "updateDocument",
  },
  {
    method: "DELETE",
    path: "/v1/documents/{documentId}",
    domain: "documents",
    wrapper: "deleteDocument",
  },
  {
    method: "PUT",
    path: "/v1/documents/{documentId}/content",
    domain: "documents",
    wrapper: "saveDocumentContent",
  },
  {
    method: "POST",
    path: "/v1/documents/{documentId}/archive",
    domain: "documents",
    wrapper: "archiveDocument",
  },
  {
    method: "GET",
    path: "/v1/templates",
    domain: "documents",
    wrapper: "templatesQueryOptions",
  },
  {
    method: "POST",
    path: "/v1/documents/bootstrap",
    domain: "documents",
    wrapper: "bootstrapFirstDocument",
  },
  {
    method: "POST",
    path: "/v1/documents/{documentId}/outline/generate",
    domain: "documents",
    wrapper: "generateDocumentOutline",
  },
  {
    method: "POST",
    path: "/v1/documents/{documentId}/outline/apply",
    domain: "documents",
    wrapper: "applyDocumentOutline",
  },
  {
    method: "POST",
    path: "/v1/documents/{documentId}/ai/proposals",
    domain: "documents",
    wrapper: "generateDocumentProposal",
  },
  {
    method: "GET",
    path: "/v1/documents/{documentId}/versions",
    domain: "documents",
    wrapper: "documentVersionsQueryOptions",
  },
  {
    method: "POST",
    path: "/v1/ai/proposals/{proposalId}/apply",
    domain: "proposals",
    wrapper: "applyProposal",
  },
  {
    method: "POST",
    path: "/v1/ai/proposals/{proposalId}/dismiss",
    domain: "proposals",
    wrapper: "dismissProposal",
  },
  {
    method: "POST",
    path: "/v1/documents/{documentId}/exports/docx/preflight",
    domain: "exports",
    wrapper: "preflightDocxExport",
  },
  {
    method: "POST",
    path: "/v1/documents/{documentId}/exports/docx",
    domain: "exports",
    wrapper: "createDocxExport",
  },
  {
    method: "GET",
    path: "/v1/exports",
    domain: "exports",
    wrapper: "exportsListQueryOptions",
  },
  {
    method: "GET",
    path: "/v1/exports/{exportId}",
    domain: "exports",
    wrapper: "exportDetailQueryOptions",
  },
  {
    method: "POST",
    path: "/v1/exports/{exportId}/retry",
    domain: "exports",
    wrapper: "retryExport",
  },
  {
    method: "GET",
    path: "/v1/exports/{exportId}/download",
    domain: "exports",
    wrapper: "downloadExport",
  },
  {
    method: "POST",
    path: "/v1/sources/upload-url",
    domain: "sources",
    wrapper: "createSourceUploadUrl",
  },
  {
    method: "POST",
    path: "/v1/sources/register",
    domain: "sources",
    wrapper: "registerSource",
  },
  {
    method: "GET",
    path: "/v1/documents/{documentId}/sources",
    domain: "sources",
    wrapper: "documentSourcesQueryOptions",
  },
  {
    method: "GET",
    path: "/v1/sources/{sourceId}/status",
    domain: "sources",
    wrapper: "sourceStatusQueryOptions",
  },
  {
    method: "POST",
    path: "/v1/sources/{sourceId}/retry",
    domain: "sources",
    wrapper: "retrySource",
  },
  {
    method: "DELETE",
    path: "/v1/sources/{sourceId}",
    domain: "sources",
    wrapper: "deleteSource",
  },
  {
    method: "GET",
    path: "/health",
    domain: "system",
    wrapper: "healthQueryOptions",
  },
  {
    method: "GET",
    path: "/v1/system/readiness",
    domain: "system",
    wrapper: "readinessQueryOptions",
  },
  {
    method: "POST",
    path: "/webhooks/clerk",
    domain: "system",
    wrapper: "excluded",
    excludeReason: "server-to-server only",
  },
] as const satisfies readonly ApiCoverageEntry[]

export function findUncoveredApiOperations(
  paths: OpenApiPaths,
  registry: readonly ApiCoverageEntry[]
) {
  const covered = new Set(registry.map((entry) => `${entry.method} ${entry.path}`))
  const uncovered: string[] = []

  for (const [path, operations] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!operation) {
        continue
      }

      const key = `${method.toUpperCase()} ${path}`
      if (!covered.has(key)) {
        uncovered.push(key)
      }
    }
  }

  return uncovered.sort()
}

export function findUnknownRegistryEntries(
  paths: OpenApiPaths,
  registry: readonly ApiCoverageEntry[]
) {
  const available = new Set<string>()

  for (const [path, operations] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!operation) {
        continue
      }

      available.add(`${method.toUpperCase()} ${path}`)
    }
  }

  return registry
    .filter((entry) => !available.has(`${entry.method} ${entry.path}`))
    .map((entry) => `${entry.method} ${entry.path}`)
    .sort()
}
