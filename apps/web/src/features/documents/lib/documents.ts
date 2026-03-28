import type { ApiJsonResponse, ApiRequestBody } from "@/lib/api-schema"

export type BootstrapDocumentInput = ApiRequestBody<
  "/v1/documents/bootstrap",
  "post"
>

export type TemplateCode = BootstrapDocumentInput["templateCode"]
export type DocumentType = BootstrapDocumentInput["type"]

export type DocumentsListResponse = ApiJsonResponse<"/v1/documents", "get", 200>
export type DocumentRecord = DocumentsListResponse["documents"][number]
export type DocumentDetailResponse = ApiJsonResponse<
  "/v1/documents/{documentId}",
  "get",
  200
>
export type DocumentVersionListResponse = ApiJsonResponse<
  "/v1/documents/{documentId}/versions",
  "get",
  200
>
