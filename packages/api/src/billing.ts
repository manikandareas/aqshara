import { apiRequest } from "./client";
import type {
  BillingCheckoutEnvelope,
  BillingCheckoutRequest,
  BillingPlansEnvelope,
  BillingSnapshotEnvelope,
} from "./contracts";
import type { TokenProvider } from "./client";

export async function listBillingPlans(getToken: TokenProvider) {
  return apiRequest<BillingPlansEnvelope>(
    {
      method: "GET",
      url: "/billing/plans",
    },
    getToken,
  );
}

export async function getMyBilling(getToken: TokenProvider) {
  return apiRequest<BillingSnapshotEnvelope>(
    {
      method: "GET",
      url: "/billing/me",
    },
    getToken,
  );
}

export async function createBillingCheckout(
  input: BillingCheckoutRequest,
  getToken: TokenProvider,
) {
  return apiRequest<BillingCheckoutEnvelope>(
    {
      method: "POST",
      url: "/billing/checkout",
      data: input,
    },
    getToken,
  );
}
