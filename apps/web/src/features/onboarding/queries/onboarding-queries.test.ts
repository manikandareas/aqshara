import { describe, expect, it } from "vitest"

import {
  ApiRequestError,
  getApiErrorMessage,
  isApiRequestErrorStatus,
} from "./onboarding-queries"

describe("onboarding query helpers", () => {
  it("detects API status-specific errors", () => {
    const error = new ApiRequestError(401, "Authentication required", "unauthorized")

    expect(isApiRequestErrorStatus(error, 401)).toBe(true)
    expect(isApiRequestErrorStatus(error, 409)).toBe(false)
  })

  it("returns the API message when available", () => {
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
