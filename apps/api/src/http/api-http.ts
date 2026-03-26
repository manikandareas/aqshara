import type { Context } from "hono";
import { createErrorPayload, getRequestId } from "./errors.js";
import type { ApiEnv } from "../hono-env.js";

export { createErrorPayload, getRequestId } from "./errors.js";

export function getDocumentId(c: Context) {
  const documentId = c.req.param("documentId");

  if (!documentId) {
    throw new Error("Document id is required");
  }

  return documentId;
}

export async function requireAppUser(c: Context<ApiEnv>) {
  const context = c.get("ctx");
  const clerkUserId = await context.getAuthenticatedClerkUserId(c as never);

  if (!clerkUserId) {
    return {
      error: c.json(
        createErrorPayload(
          "unauthorized",
          "Authentication required",
          getRequestId(c),
        ),
        401,
      ),
    };
  }

  const user = await context.repository.getUserByClerkUserId(clerkUserId);

  if (!user) {
    return {
      error: c.json(
        createErrorPayload(
          "account_provisioning",
          "Account provisioning is still pending",
          getRequestId(c),
        ),
        409,
      ),
    };
  }

  if (user.deletedAt) {
    return {
      error: c.json(
        createErrorPayload(
          "account_deleted",
          "Account access has been removed",
          getRequestId(c),
        ),
        403,
      ),
    };
  }

  const workspace = await context.repository.getWorkspaceForUser(user.id);

  if (!workspace) {
    return {
      error: c.json(
        createErrorPayload(
          "account_provisioning",
          "Account provisioning is still pending",
          getRequestId(c),
        ),
        409,
      ),
    };
  }

  return {
    bootstrap: {
      user,
      workspace,
    },
  };
}
