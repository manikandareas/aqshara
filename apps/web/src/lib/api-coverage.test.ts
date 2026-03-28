import apiSpec from "../../../api/openapi/openapi.json"
import { describe, expect, it } from "vitest"

import {
  apiCoverageRegistry,
  findUncoveredApiOperations,
  findUnknownRegistryEntries,
} from "./api-coverage"

describe("api coverage registry", () => {
  it("covers every existing API operation or excludes it explicitly", () => {
    expect(findUncoveredApiOperations(apiSpec.paths, apiCoverageRegistry)).toEqual([])
  })

  it("does not contain registry entries for operations missing from the current spec", () => {
    expect(findUnknownRegistryEntries(apiSpec.paths, apiCoverageRegistry)).toEqual([])
  })

  it("marks the Clerk webhook as intentionally excluded from the web app", () => {
    expect(
      apiCoverageRegistry.find(
        (entry) => entry.method === "POST" && entry.path === "/webhooks/clerk"
      )
    ).toEqual(
      expect.objectContaining({
        excludeReason: "server-to-server only",
      })
    )
  })
})
