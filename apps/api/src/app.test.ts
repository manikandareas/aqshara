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

  it("serves a Scalar API reference UI", async () => {
    const app = createApp(createMemoryAppContext());
    const response = await app.request("http://localhost/scalar");
    const payload = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
    assert.match(payload, /openapi\.json/i);
  });

  it("publishes an llms.txt markdown reference", async () => {
    const app = createApp(createMemoryAppContext());
    const response = await app.request("http://localhost/llms.txt");
    const payload = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/plain/i);
    assert.match(payload, /Aqshara API|\/v1\/me/i);
  });
});

describe("clerk webhook provisioning", () => {
  it("creates an internal user and default workspace from a user.created webhook", async () => {
    const app = createApp(createMemoryAppContext());
    const webhookResponse = await app.request(
      "http://localhost/webhooks/clerk",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createClerkUserEvent("user.created")),
      },
    );

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
    assert.ok(payload.usage !== undefined, "usage should be present");
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
    const webhookResponse = await app.request(
      "http://localhost/webhooks/clerk",
      {
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
      },
    );

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
    const webhookResponse = await app.request(
      "http://localhost/webhooks/clerk",
      {
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
      },
    );

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

  it("rejects invalid webhook signatures", async () => {
    const app = createApp(createMemoryAppContext());
    const webhookResponse = await app.request(
      "http://localhost/webhooks/clerk",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "clerk-signature": "invalid",
        },
        body: JSON.stringify(createClerkUserEvent("user.created")),
      },
    );

    const payload = await webhookResponse.json();
    assert.equal(webhookResponse.status, 400);
    assert.equal(payload.code, "invalid_webhook");

    const response = await app.request("http://localhost/v1/me", {
      headers: {
        "x-test-user-id": "user_clerk_123",
      },
    });
    assert.equal(response.status, 409);
  });

  it("handles duplicate user.created webhooks idempotently", async () => {
    const app = createApp(createMemoryAppContext());
    const event = JSON.stringify(createClerkUserEvent("user.created"));

    const res1 = await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: event,
    });
    assert.equal(res1.status, 200);

    const res2 = await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: event,
    });
    assert.equal(res2.status, 200);

    const response = await app.request("http://localhost/v1/me", {
      headers: { "x-test-user-id": "user_clerk_123" },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.user.email, "user@example.com");
  });

  it("ignores user.created webhooks without a primary email", async () => {
    const app = createApp(createMemoryAppContext());
    const event = createClerkUserEvent("user.created");
    event.data.email_addresses = [];

    const webhookResponse = await app.request(
      "http://localhost/webhooks/clerk",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
      },
    );

    assert.equal(webhookResponse.status, 200);

    const response = await app.request("http://localhost/v1/me", {
      headers: { "x-test-user-id": "user_clerk_123" },
    });
    assert.equal(response.status, 409);
  });

  it("safely ignores user.deleted webhooks for unknown users", async () => {
    const app = createApp(createMemoryAppContext());
    const webhookResponse = await app.request(
      "http://localhost/webhooks/clerk",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user.deleted",
          data: { id: "unknown_user_123" },
        }),
      },
    );

    assert.equal(webhookResponse.status, 200);
  });

  it("does not resurrect a soft-deleted user on user.updated", async () => {
    const app = createApp(createMemoryAppContext());

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: "user_delete_test" }),
      ),
    });

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "user.deleted",
        data: { id: "user_delete_test" },
      }),
    });

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.updated", {
          id: "user_delete_test",
          email: "new@example.com",
        }),
      ),
    });

    const response = await app.request("http://localhost/v1/me", {
      headers: { "x-test-user-id": "user_delete_test" },
    });

    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "account_deleted");
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

  it("returns rich session bootstrap data including documentStats and onboarding", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_onboard_test";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: clerkId }),
      ),
    });

    let response = await app.request("http://localhost/v1/me", {
      headers: { "x-test-user-id": clerkId },
    });
    let payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.documentStats, {
      activeCount: 0,
      archivedCount: 0,
    });
    assert.deepEqual(payload.onboarding, {
      shouldShow: true,
      reason: "zero_documents",
    });
    assert.ok("period" in payload.usage);
    assert.ok("aiActionsUsed" in payload.usage);

    await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test-user-id": clerkId,
      },
      body: JSON.stringify({ title: "My Doc", type: "general_paper" }),
    });

    response = await app.request("http://localhost/v1/me", {
      headers: { "x-test-user-id": clerkId },
    });
    payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.documentStats, {
      activeCount: 1,
      archivedCount: 0,
    });
    assert.deepEqual(payload.onboarding, {
      shouldShow: false,
      reason: "has_documents",
    });
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
    assert.equal(
      createdDocument.document.workspaceId,
      bootstrapPayload.workspace.id,
    );

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
          contentJson: [
            {
              type: "heading",
              id: "h1",
              level: 1,
              children: [{ text: "Pendahuluan" }],
            },
            {
              type: "paragraph",
              id: "p1",
              children: [{ text: "Latar belakang masalah." }],
            },
          ],
          baseUpdatedAt: createdDocument.document.updatedAt,
        }),
      },
    );
    const savedPayload = await saveResponse.json();

    assert.equal(saveResponse.status, 200);
    assert.equal(
      savedPayload.document.plainText,
      "Pendahuluan\nLatar belakang masalah.",
    );

    const staleSaveResponse = await app.request(
      `http://localhost/v1/documents/${createdDocument.document.id}/content`,
      {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          contentJson: [
            {
              type: "paragraph",
              id: "p1",
              children: [{ text: "Should be rejected" }],
            },
          ],
          baseUpdatedAt: createdDocument.document.updatedAt,
        }),
      },
    );
    const staleSavePayload = await staleSaveResponse.json();

    assert.equal(staleSaveResponse.status, 409);
    assert.equal(staleSavePayload.code, "stale_document_save");

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
    assert.equal(
      archivedListPayload.documents[0].title,
      "Draft Skripsi Revisi",
    );

    const deleteResponse = await app.request(
      `http://localhost/v1/documents/${createdDocument.document.id}`,
      {
        method: "DELETE",
        headers: authHeaders,
      },
    );

    assert.equal(deleteResponse.status, 204);

    const emptyListResponse = await app.request(
      "http://localhost/v1/documents",
      {
        headers: authHeaders,
      },
    );
    const emptyListPayload = await emptyListResponse.json();

    assert.equal(emptyListResponse.status, 200);
    assert.equal(emptyListPayload.documents.length, 0);
  });

  it("lists recent documents with limit and excludes archived documents", async () => {
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

    for (let i = 1; i <= 6; i++) {
      await app.request("http://localhost/v1/documents", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: `Doc ${i}`,
          type: "skripsi",
        }),
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const listResponse = await app.request(
      "http://localhost/v1/documents/recent",
      {
        headers: authHeaders,
      },
    );
    const listPayload = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listPayload.documents.length, 5);
    assert.equal(listPayload.documents[0].title, "Doc 6");

    const listLimitResponse = await app.request(
      "http://localhost/v1/documents/recent?limit=2",
      {
        headers: authHeaders,
      },
    );
    const listLimitPayload = await listLimitResponse.json();

    assert.equal(listLimitResponse.status, 200);
    assert.equal(listLimitPayload.documents.length, 2);
    assert.equal(listLimitPayload.documents[0].title, "Doc 6");
    assert.equal(listLimitPayload.documents[1].title, "Doc 5");

    await app.request(
      `http://localhost/v1/documents/${listLimitPayload.documents[0].id}/archive`,
      {
        method: "POST",
        headers: authHeaders,
      },
    );

    const listAfterArchiveResponse = await app.request(
      "http://localhost/v1/documents/recent",
      {
        headers: authHeaders,
      },
    );
    const listAfterArchivePayload = await listAfterArchiveResponse.json();

    assert.equal(listAfterArchiveResponse.status, 200);
    assert.equal(listAfterArchivePayload.documents.length, 5);
    assert.equal(listAfterArchivePayload.documents[0].title, "Doc 5");
  });
});

describe("proposal apply and dismiss", () => {
  it("applies a proposal with replace and insert_below modes", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: "user_p_1" }),
      ),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": "user_p_1",
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document: initialDoc } = await createRes.json();

    const saveRes = await app.request(
      `http://localhost/v1/documents/${initialDoc.id}/content`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user_p_1",
        },
        body: JSON.stringify({
          contentJson: [
            { type: "paragraph", id: "b1", children: [{ text: "Hello" }] },
          ],
          baseUpdatedAt: initialDoc.updatedAt,
        }),
      },
    );

    // We mock the DB state directly since Task 8 isn't in app.ts
    const replaceProposal =
      await context.repository.createDocumentChangeProposal({
        documentId: initialDoc.id,
        userId: (
          await (
            await app.request("http://localhost/v1/me", {
              headers: { "x-test-user-id": "user_p_1" },
            })
          ).json()
        ).user.id,
        proposalJson: {
          id: "p1",
          targetBlockIds: ["b1"],
          action: "replace",
          nodes: [
            { type: "paragraph", id: "b1", children: [{ text: "Replaced" }] },
          ],
        },
        actionType: "replace",
        baseUpdatedAt: (await saveRes.json()).document.updatedAt,
        targetBlockIds: ["b1"],
      });

    const applyRes = await app.request(
      `http://localhost/v1/ai/proposals/${replaceProposal.id}/apply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user_p_1",
        },
        body: JSON.stringify({
          mode: "replace",
          baseUpdatedAt: replaceProposal.baseUpdatedAt,
        }),
      },
    );
    assert.equal(applyRes.status, 200);
    const applyPayload = await applyRes.json();
    assert.equal(applyPayload.proposal.status, "applied");
    assert.equal(
      applyPayload.document.contentJson[0].children[0].text,
      "Replaced",
    );

    // Insert Below
    const insertProposal =
      await context.repository.createDocumentChangeProposal({
        documentId: initialDoc.id,
        userId: (
          await (
            await app.request("http://localhost/v1/me", {
              headers: { "x-test-user-id": "user_p_1" },
            })
          ).json()
        ).user.id,
        proposalJson: {
          id: "p2",
          targetBlockIds: ["b1"],
          action: "insert_below",
          nodes: [
            { type: "paragraph", id: "b2", children: [{ text: "Below" }] },
          ],
        },
        actionType: "insert_below",
        baseUpdatedAt: applyPayload.document.updatedAt,
        targetBlockIds: ["b1"],
      });

    const applyInsertRes = await app.request(
      `http://localhost/v1/ai/proposals/${insertProposal.id}/apply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user_p_1",
        },
        body: JSON.stringify({
          mode: "insert_below",
          baseUpdatedAt: insertProposal.baseUpdatedAt,
        }),
      },
    );
    assert.equal(applyInsertRes.status, 200);
    const insertPayload = await applyInsertRes.json();
    assert.equal(insertPayload.document.contentJson.length, 2);
  });

  it("handles stale apply and terminal state rejections", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: "user_p_2" }),
      ),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": "user_p_2",
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document: initialDoc } = await createRes.json();

    const staleProposal = await context.repository.createDocumentChangeProposal(
      {
        documentId: initialDoc.id,
        userId: (
          await (
            await app.request("http://localhost/v1/me", {
              headers: { "x-test-user-id": "user_p_2" },
            })
          ).json()
        ).user.id,
        proposalJson: {
          id: "p1",
          targetBlockIds: [],
          action: "replace",
          nodes: [],
        },
        actionType: "replace",
        baseUpdatedAt: new Date(Date.now() - 10000).toISOString(),
        targetBlockIds: [],
      },
    );

    const applyStaleRes = await app.request(
      `http://localhost/v1/ai/proposals/${staleProposal.id}/apply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user_p_2",
        },
        body: JSON.stringify({
          mode: "replace",
          baseUpdatedAt: staleProposal.baseUpdatedAt,
        }),
      },
    );
    assert.equal(applyStaleRes.status, 409);
    assert.equal((await applyStaleRes.json()).code, "stale_ai_proposal");

    const refetchedStale = await context.repository.getDocumentChangeProposal(
      staleProposal.id,
    );
    assert.equal(refetchedStale!.status, "invalidated");

    const terminalProposal =
      await context.repository.createDocumentChangeProposal({
        documentId: initialDoc.id,
        userId: (
          await (
            await app.request("http://localhost/v1/me", {
              headers: { "x-test-user-id": "user_p_2" },
            })
          ).json()
        ).user.id,
        proposalJson: {
          id: "p2",
          targetBlockIds: [],
          action: "replace",
          nodes: [],
        },
        actionType: "replace",
        baseUpdatedAt: initialDoc.updatedAt,
        targetBlockIds: [],
      });
    await context.repository.updateDocumentChangeProposalStatus({
      id: terminalProposal.id,
      userId: (
        await (
          await app.request("http://localhost/v1/me", {
            headers: { "x-test-user-id": "user_p_2" },
          })
        ).json()
      ).user.id,
      status: "applied",
    });

    const applyTerminalRes = await app.request(
      `http://localhost/v1/ai/proposals/${terminalProposal.id}/apply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user_p_2",
        },
        body: JSON.stringify({
          mode: "replace",
          baseUpdatedAt: terminalProposal.baseUpdatedAt,
        }),
      },
    );
    assert.equal(applyTerminalRes.status, 409);
    assert.equal((await applyTerminalRes.json()).code, "stale_ai_proposal");
  });

  it("dismisses proposals idempotently", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: "user_p_3" }),
      ),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": "user_p_3",
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document: initialDoc } = await createRes.json();

    const prop = await context.repository.createDocumentChangeProposal({
      documentId: initialDoc.id,
      userId: (
        await (
          await app.request("http://localhost/v1/me", {
            headers: { "x-test-user-id": "user_p_3" },
          })
        ).json()
      ).user.id,
      proposalJson: {
        id: "p1",
        targetBlockIds: [],
        action: "replace",
        nodes: [],
      },
      actionType: "replace",
      baseUpdatedAt: initialDoc.updatedAt,
      targetBlockIds: [],
    });

    const dismissRes1 = await app.request(
      `http://localhost/v1/ai/proposals/${prop.id}/dismiss`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user_p_3",
        },
      },
    );
    assert.equal(dismissRes1.status, 200);
    assert.equal((await dismissRes1.json()).proposal.status, "dismissed");

    const dismissRes2 = await app.request(
      `http://localhost/v1/ai/proposals/${prop.id}/dismiss`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user_p_3",
        },
      },
    );
    assert.equal(dismissRes2.status, 200);
  });

  it("rejects apply when proposal base mismatches request", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: "user_p_4" }),
      ),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": "user_p_4",
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document: initialDoc } = await createRes.json();

    const staleProp = await context.repository.createDocumentChangeProposal({
      documentId: initialDoc.id,
      userId: (
        await (
          await app.request("http://localhost/v1/me", {
            headers: { "x-test-user-id": "user_p_4" },
          })
        ).json()
      ).user.id,
      proposalJson: {
        id: "p1",
        targetBlockIds: [],
        action: "replace",
        nodes: [],
      },
      actionType: "replace",
      baseUpdatedAt: new Date(Date.now() - 10000).toISOString(),
      targetBlockIds: [],
    });

    const applyStaleRes = await app.request(
      `http://localhost/v1/ai/proposals/${staleProp.id}/apply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user_p_4",
        },
        body: JSON.stringify({
          mode: "replace",
          baseUpdatedAt: initialDoc.updatedAt, // Request matches doc, but not proposal base
        }),
      },
    );

    // Assert 409 and invalidated state
    const payload = await applyStaleRes.json();
    if (applyStaleRes.status !== 409 || payload.code !== "stale_ai_proposal")
      throw new Error("Expected 409 stale_ai_proposal");
  });

  it("dismiss does not mutate terminal proposals", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: "user_p_5" }),
      ),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": "user_p_5",
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document: initialDoc } = await createRes.json();

    const prop = await context.repository.createDocumentChangeProposal({
      documentId: initialDoc.id,
      userId: (
        await (
          await app.request("http://localhost/v1/me", {
            headers: { "x-test-user-id": "user_p_5" },
          })
        ).json()
      ).user.id,
      proposalJson: {
        id: "p1",
        targetBlockIds: [],
        action: "replace",
        nodes: [],
      },
      actionType: "replace",
      baseUpdatedAt: initialDoc.updatedAt,
      targetBlockIds: [],
    });

    await context.repository.updateDocumentChangeProposalStatus({
      id: prop.id,
      userId: (
        await (
          await app.request("http://localhost/v1/me", {
            headers: { "x-test-user-id": "user_p_5" },
          })
        ).json()
      ).user.id,
      status: "applied",
    });

    const dismissRes = await app.request(
      `http://localhost/v1/ai/proposals/${prop.id}/dismiss`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": "user_p_5",
        },
      },
    );

    const payload = await dismissRes.json();
    if (payload.proposal.status !== "applied")
      throw new Error("Dismiss should not mutate already applied proposal");
  });
});

describe("AI action error handling", () => {
  it("releases AI action reservation on provider failure for outline generation", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_ai_error_1";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: clerkId }),
      ),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": clerkId,
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document: initialDoc } = await createRes.json();

    const originalGenerateOutlineDraft =
      context.aiService.generateOutlineDraft;
    context.aiService.generateOutlineDraft = async () => {
      throw new Error("Provider downstream failure");
    };

    const idempotencyKey = "test_outline_failure";

    const res = await app.request(
      `http://localhost/v1/documents/${initialDoc.id}/outline/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({
          topic: "Some Topic",
          idempotencyKey,
        }),
      },
    );

    assert.equal(res.status, 500);

    const usage = (
      await (
        await app.request("http://localhost/v1/me", {
          headers: { "x-test-user-id": clerkId },
        })
      ).json()
    ).usage;

    assert.equal(usage.aiActionsUsed, 0);
    assert.equal(usage.aiActionsReserved, 0);

    context.aiService.generateOutlineDraft = originalGenerateOutlineDraft;
  });

  it("releases AI action reservation on finalize failure for outline generation", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_ai_error_1b";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: clerkId }),
      ),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": clerkId,
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document: initialDoc } = await createRes.json();

    const originalFinalizeAiAction = context.repository.finalizeAiAction;
    context.repository.finalizeAiAction = async () => {
      throw new Error("Database failure during finalize");
    };

    const idempotencyKey = "test_outline_finalize_failure";

    const res = await app.request(
      `http://localhost/v1/documents/${initialDoc.id}/outline/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({
          topic: "Some Topic",
          idempotencyKey,
        }),
      },
    );

    assert.equal(res.status, 500);

    const usage = (
      await (
        await app.request("http://localhost/v1/me", {
          headers: { "x-test-user-id": clerkId },
        })
      ).json()
    ).usage;

    assert.equal(usage.aiActionsUsed, 0);
    assert.equal(usage.aiActionsReserved, 0);

    context.repository.finalizeAiAction = originalFinalizeAiAction;
  });

  it("releases AI action reservation on provider failure for AI writing proposals", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_ai_error_2";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: clerkId }),
      ),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": clerkId,
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document: initialDoc } = await createRes.json();

    await app.request(
      `http://localhost/v1/documents/${initialDoc.id}/content`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({
          contentJson: [
            { type: "paragraph", id: "b1", children: [{ text: "Hello" }] },
          ],
          baseUpdatedAt: initialDoc.updatedAt,
        }),
      },
    );

    // Monkey patch aiService to throw an error
    const originalGenerateWritingProposal =
      context.aiService.generateWritingProposal;
    context.aiService.generateWritingProposal = async () => {
      throw new Error("Provider downstream failure");
    };

    const idempotencyKey = "test_proposal_failure";

    const res = await app.request(
      `http://localhost/v1/documents/${initialDoc.id}/ai/proposals`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({
          action: "continue",
          targetBlockIds: ["b1"],
          idempotencyKey,
        }),
      },
    );

    assert.equal(res.status, 500);

    // Verify reservation was released
    const usage = (
      await (
        await app.request("http://localhost/v1/me", {
          headers: { "x-test-user-id": clerkId },
        })
      ).json()
    ).usage;

    // Usage should have 0 actions used and 0 actions reserved
    assert.equal(usage.aiActionsUsed, 0);
    assert.equal(usage.aiActionsReserved, 0);

    // Restore
    context.aiService.generateWritingProposal = originalGenerateWritingProposal;
  });
});
