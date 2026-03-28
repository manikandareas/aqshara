import { describe, expect, it } from "vitest"

import {
  ApiRequestError,
  getApiErrorMessage,
  isApiRequestErrorStatus,
  requireApiData,
  toApiRequestError,
} from "./api-client"

describe("api-client helpers", () => {
  it("creates typed request errors from API payloads", () => {
    const error = toApiRequestError(
      404,
      {
        code: "not_found",
        message: "Document not found.",
        requestId: "req_123",
      },
      "Fallback message"
    )

    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error.status).toBe(404)
    expect(error.code).toBe("not_found")
    expect(error.requestId).toBe("req_123")
    expect(error.message).toBe("Document not found.")
  })

  it("detects status-specific API errors", () => {
    const error = new ApiRequestError(401, "Authentication required", "unauthorized")

    expect(isApiRequestErrorStatus(error, 401)).toBe(true)
    expect(isApiRequestErrorStatus(error, 409)).toBe(false)
  })

  it("returns payload data when present", () => {
    expect(requireApiData({ ok: true }, "Missing payload")).toEqual({ ok: true })
  })

  it("throws when payload data is missing", () => {
    expect(() => requireApiData(undefined, "Missing payload")).toThrowError(
      "Missing payload"
    )
  })

  it("prefers API error messages over fallback copy", () => {
    expect(
      getApiErrorMessage(
        new ApiRequestError(
          400,
          "Template does not match the selected document type.",
          "bad_request"
        )
      )
    ).toBe("Template does not match the selected document type.")
  })
})
