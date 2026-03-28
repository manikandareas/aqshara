import { describe, expect, it } from "vitest"

import {
  bootstrapDocumentMutationKey,
  documentDetailQueryKey,
  documentVersionsQueryKey,
  documentsListQueryKey,
  recentDocumentsQueryKey,
  templatesQueryKey,
} from "./documents-queries"

describe("document queries", () => {
  it("builds stable list keys", () => {
    expect(documentsListQueryKey()).toEqual(["documents", "list", {}])
    expect(documentsListQueryKey({ status: "archived" })).toEqual([
      "documents",
      "list",
      { status: "archived" },
    ])
    expect(recentDocumentsQueryKey()).toEqual(["documents", "recent", {}])
    expect(recentDocumentsQueryKey({ limit: 3 })).toEqual([
      "documents",
      "recent",
      { limit: 3 },
    ])
  })

  it("builds stable entity keys", () => {
    expect(documentDetailQueryKey("doc_123")).toEqual(["documents", "detail", "doc_123"])
    expect(documentVersionsQueryKey("doc_123")).toEqual([
      "documents",
      "versions",
      "doc_123",
    ])
    expect(templatesQueryKey).toEqual(["documents", "templates"])
    expect(bootstrapDocumentMutationKey).toEqual(["documents", "bootstrap"])
  })
})
