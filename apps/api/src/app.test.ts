import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "./app.js";
import { createMemoryAppContext } from "./test-support/memory-app-context.js";

function createClerkUserEvent(
  type: "user.created" | "user.updated",
  overrides: Partial<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  }> = {},
) {
  const id = overrides.id ?? "user_clerk_123";
  const email = overrides.email ?? "user@example.com";

  return {
    type,
    data: {
      id,
      primary_email_address_id: `${id}_primary_email`,
      email_addresses: [
        {
          id: `${id}_primary_email`,
          email_address: email,
        },
      ],
      first_name: overrides.firstName ?? "Aqshara",
      last_name: overrides.lastName ?? "User",
      username: null,
      image_url: overrides.imageUrl ?? null,
    },
  };
}

describe("api contract", () => {
  it("returns a healthy response from /health", async () => {
    const app = createApp(createMemoryAppContext());
    const response = await app.request("http://localhost/health");
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.service, "api");
  });

  it("publishes an OpenAPI document", async () => {
    const app = createApp(createMemoryAppContext());
    const response = await app.request("http://localhost/openapi.json");
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof payload.openapi, "string");
    assert.equal(payload.info.title, "Aqshara API");
  });
});

describe("clerk webhook provisioning", () => {
  it("creates an internal user and default workspace from a user.created webhook", async () => {
    const app = createApp(createMemoryAppContext());
    const webhookResponse = await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(createClerkUserEvent("user.created")),
    });

    assert.equal(webhookResponse.status, 200);

    const response = await app.request("http://localhost/v1/me", {
      headers: {
        "x-test-user-id": "user_clerk_123",
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.user.email, "user@example.com");
    assert.equal(payload.user.clerkUserId, "user_clerk_123");
    assert.equal(payload.workspace.name, "My Workspace");
    assert.equal(payload.plan.code, "free");
    assert.deepEqual(payload.usage, {
      aiActionsRemaining: 10,
      exportsRemaining: 3,
      sourceUploadsRemaining: 0,
    });
  });

  it("updates a provisioned user from a user.updated webhook", async () => {
    const app = createApp(createMemoryAppContext());
    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(createClerkUserEvent("user.created")),
    });
    const webhookResponse = await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        createClerkUserEvent("user.updated", {
          email: "updated@example.com",
          firstName: "Updated",
          lastName: "Name",
          imageUrl: "https://example.com/avatar.png",
        }),
      ),
    });

    assert.equal(webhookResponse.status, 200);

    const response = await app.request("http://localhost/v1/me", {
      headers: {
        "x-test-user-id": "user_clerk_123",
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.user.email, "updated@example.com");
    assert.equal(payload.user.name, "Updated Name");
    assert.equal(payload.user.avatarUrl, "https://example.com/avatar.png");
  });

  it("soft deletes a provisioned user from a user.deleted webhook", async () => {
    const app = createApp(createMemoryAppContext());
    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(createClerkUserEvent("user.created")),
    });
    const webhookResponse = await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "user.deleted",
        data: {
          id: "user_clerk_123",
        },
      }),
    });

    assert.equal(webhookResponse.status, 200);

    const response = await app.request("http://localhost/v1/me", {
      headers: {
        "x-test-user-id": "user_clerk_123",
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.code, "account_deleted");
  });
});

describe("authenticated session resolution", () => {
  it("rejects protected routes without authentication", async () => {
    const app = createApp(createMemoryAppContext());
    const response = await app.request("http://localhost/v1/me");
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.code, "unauthorized");
  });

  it("returns provisioning pending when the authenticated user is not in the local database", async () => {
    const app = createApp(createMemoryAppContext());
    const response = await app.request("http://localhost/v1/me", {
      headers: {
        "x-test-user-id": "user_clerk_123",
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.code, "account_provisioning");
  });
});

describe("document workflow", () => {
  it("creates, lists, updates, archives, and deletes documents for the signed-in user", async () => {
    const app = createApp(createMemoryAppContext());
    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(createClerkUserEvent("user.created")),
    });
    const authHeaders = {
      "content-type": "application/json",
      "x-test-user-id": "user_clerk_123",
    };

    const bootstrapResponse = await app.request("http://localhost/v1/me", {
      headers: authHeaders,
    });
    const bootstrapPayload = await bootstrapResponse.json();

    const createResponse = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Draft Skripsi",
        type: "skripsi",
      }),
    });
    const createdDocument = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createdDocument.document.title, "Draft Skripsi");
    assert.equal(createdDocument.document.type, "skripsi");
    assert.equal(createdDocument.document.workspaceId, bootstrapPayload.workspace.id);

    const listResponse = await app.request("http://localhost/v1/documents", {
      headers: authHeaders,
    });
    const listedDocuments = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listedDocuments.documents.length, 1);

    const saveResponse = await app.request(
      `http://localhost/v1/documents/${createdDocument.document.id}/content`,
      {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          contentJson: {
            version: 1,
            nodes: [
              { type: "heading", level: 1, text: "Pendahuluan" },
              { type: "paragraph", text: "Latar belakang masalah." },
            ],
          },
        }),
      },
    );
    const savedPayload = await saveResponse.json();

    assert.equal(saveResponse.status, 200);
    assert.equal(savedPayload.document.plainText, "Pendahuluan\nLatar belakang masalah.");

    const renameResponse = await app.request(
      `http://localhost/v1/documents/${createdDocument.document.id}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          title: "Draft Skripsi Revisi",
        }),
      },
    );

    assert.equal(renameResponse.status, 200);

    const archiveResponse = await app.request(
      `http://localhost/v1/documents/${createdDocument.document.id}/archive`,
      {
        method: "POST",
        headers: authHeaders,
      },
    );

    assert.equal(archiveResponse.status, 200);

    const archivedListResponse = await app.request(
      "http://localhost/v1/documents?status=archived",
      {
        headers: authHeaders,
      },
    );
    const archivedListPayload = await archivedListResponse.json();

    assert.equal(archivedListResponse.status, 200);
    assert.equal(archivedListPayload.documents.length, 1);
    assert.equal(archivedListPayload.documents[0].title, "Draft Skripsi Revisi");

    const deleteResponse = await app.request(
      `http://localhost/v1/documents/${createdDocument.document.id}`,
      {
        method: "DELETE",
        headers: authHeaders,
      },
    );

    assert.equal(deleteResponse.status, 204);

    const emptyListResponse = await app.request("http://localhost/v1/documents", {
      headers: authHeaders,
    });
    const emptyListPayload = await emptyListResponse.json();

    assert.equal(emptyListResponse.status, 200);
    assert.equal(emptyListPayload.documents.length, 0);
  });
});
