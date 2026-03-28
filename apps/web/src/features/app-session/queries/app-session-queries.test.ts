import { describe, expect, it } from "vitest"

import {
  appSessionQueryKey,
  appSessionQueryOptions,
} from "./app-session-queries"

describe("app-session queries", () => {
  it("uses a stable app session cache key", () => {
    expect(appSessionQueryKey).toEqual(["app-session"])
    expect(appSessionQueryOptions().queryKey).toEqual(["app-session"])
  })

  it("keeps polling while provisioning is pending", () => {
    const refetchInterval = appSessionQueryOptions().refetchInterval as (
      query: unknown
    ) => number | false

    expect(
      refetchInterval({
        state: {
          data: null,
        },
      } as never)
    ).toBe(3_000)
  })

  it("stops polling once the app session exists", () => {
    const refetchInterval = appSessionQueryOptions().refetchInterval as (
      query: unknown
    ) => number | false

    expect(
      refetchInterval({
        state: {
          data: {
            onboarding: {
              shouldShow: false,
              reason: "has_documents",
            },
          },
        },
      } as never)
    ).toBe(false)
  })
})
