import type { Context } from "hono";
import { createErrorPayload, getRequestId } from "./errors.js";
import type { ApiEnv } from "../hono-env.js";
import { logApiErrorEvent } from "../lib/error-events.js";
import { toProvisioningIdentityFromClerkUser } from "../lib/clerk-provisioning.js";

async function tryBootstrapAppUser(c: Context<ApiEnv>, clerkUserId: string) {
  const context = c.get("ctx");
  const clerkUser = await context.getClerkUserById(clerkUserId);
  if (!clerkUser) {
    return null;
  }

  const identity = toProvisioningIdentityFromClerkUser(clerkUser);
  if (!identity) {
    return null;
  }

  return context.repository.upsertUserFromWebhook(identity);
}

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
  const requestId = getRequestId(c);

  if (!clerkUserId) {
    logApiErrorEvent({
      domain: "auth",
      path: c.req.path,
      requestId,
      code: "unauthorized",
      failureClass: "user",
    });
    return {
      error: c.json(
        createErrorPayload(
          "unauthorized",
          "Authentication required",
          requestId,
        ),
        401,
      ),
    };
  }

  const user = await context.repository.getUserByClerkUserId(clerkUserId);

  if (!user) {
    const bootstrap = await tryBootstrapAppUser(c, clerkUserId);

    if (bootstrap) {
      return {
        bootstrap,
      };
    }

    logApiErrorEvent({
      domain: "auth",
      path: c.req.path,
      requestId,
      code: "account_provisioning",
      failureClass: "system",
      clerkUserId,
    });
    return {
      error: c.json(
        createErrorPayload(
          "account_provisioning",
          "Account provisioning is still pending",
          requestId,
        ),
        409,
      ),
    };
  }

  if (user.deletedAt) {
    logApiErrorEvent({
      domain: "auth",
      path: c.req.path,
      requestId,
      code: "account_deleted",
      failureClass: "user",
      userId: user.id,
      clerkUserId,
    });
    return {
      error: c.json(
        createErrorPayload(
          "account_deleted",
          "Account access has been removed",
          requestId,
        ),
        403,
      ),
    };
  }

  const workspace = await context.repository.getWorkspaceForUser(user.id);

  if (!workspace) {
    const bootstrap = await tryBootstrapAppUser(c, clerkUserId);

    if (bootstrap) {
      return {
        bootstrap,
      };
    }

    logApiErrorEvent({
      domain: "auth",
      path: c.req.path,
      requestId,
      code: "account_provisioning",
      failureClass: "system",
      userId: user.id,
      clerkUserId,
    });
    return {
      error: c.json(
        createErrorPayload(
          "account_provisioning",
          "Account provisioning is still pending",
          requestId,
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
