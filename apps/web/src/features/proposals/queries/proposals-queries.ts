import type { ApiRequestBody } from "@/lib/api-schema"
import { apiPost, requireApiData, toApiRequestError } from "@/lib/api-client"

export type ApplyProposalInput = ApiRequestBody<
  "/v1/ai/proposals/{proposalId}/apply",
  "post"
>

export async function applyProposal(proposalId: string, input: ApplyProposalInput) {
  const result = await apiPost("/v1/ai/proposals/{proposalId}/apply", {
    params: {
      path: {
        proposalId,
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
      "Failed to apply the proposal."
    )
  }

  return requireApiData(result.data, "Missing apply proposal response.")
}

export async function dismissProposal(proposalId: string) {
  const result = await apiPost("/v1/ai/proposals/{proposalId}/dismiss", {
    params: {
      path: {
        proposalId,
      },
    },
  })

  if (result.error) {
    throw toApiRequestError(
      result.response.status,
      result.error,
      "Failed to dismiss the proposal."
    )
  }

  return requireApiData(result.data, "Missing dismiss proposal response.")
}
