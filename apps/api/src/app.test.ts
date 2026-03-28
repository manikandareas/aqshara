import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  createStorageKey,
  getSourcesRootDir,
  sourceOriginalKey,
  writeExportFile,
} from "@aqshara/storage";
import { createApp } from "./app.js";
import { PLAN_LIMITS } from "./lib/plan-limits.js";
import { getCurrentBillingPeriod } from "./repositories/billing-period.js";
import {
  createMemoryAppContext,
  MemoryRepository,
} from "./test-support/memory-app-context.js";

const MINIMAL_PDF_BUFFER = Buffer.from(`%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>endobj
4 0 obj<< /Length 44 >>stream
BT
/F1 24 Tf
100 100 Td
(Hello PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000212 00000 n 
trailer<< /Root 1 0 R /Size 5 >>
startxref
312
%%EOF`);

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function captureErrorEvents<T>(
  action: () => T | Promise<T>,
): Promise<{ result: T; events: Array<Record<string, unknown>> }> {
  const lines: string[] = [];
  const originalInfo = console.info;

  console.info = ((value?: unknown, ...rest: unknown[]) => {
    lines.push([value, ...rest].map((entry) => String(entry)).join(" "));
  }) as typeof console.info;

  try {
    const result = await action();
    const events = lines
      .filter((line) => line.trim().startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((payload) => payload.type === "error_event");

    return { result, events };
  } finally {
    console.info = originalInfo;
  }
}

async function captureLaunchEvents<T>(
  action: () => T | Promise<T>,
): Promise<{ result: T; events: Array<Record<string, unknown>> }> {
  const lines: string[] = [];
  const originalInfo = console.info;

  console.info = ((value?: unknown, ...rest: unknown[]) => {
    lines.push([value, ...rest].map((entry) => String(entry)).join(" "));
  }) as typeof console.info;

  try {
    const result = await action();
    const events = lines
      .filter((line) => line.trim().startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((payload) => payload.type === "launch_event");

    return { result, events };
  } finally {
    console.info = originalInfo;
  }
}

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
  it("answers CORS preflight for authenticated v1 routes", async () => {
    const app = createApp(createMemoryAppContext());
    const response = await app.request("http://localhost/v1/me", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization,content-type",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:3000",
    );
    assert.match(
      response.headers.get("access-control-allow-headers") ?? "",
      /authorization/i,
    );
  });

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

  it("documents DOCX export workspace mismatch as a 403 response", async () => {
    const app = createApp(createMemoryAppContext());
    const response = await app.request("http://localhost/openapi.json");
    const payload = await response.json();

    const docxExportPost =
      payload.paths["/v1/documents/{documentId}/exports/docx"]?.post;

    assert.ok(docxExportPost, "expected DOCX export route in OpenAPI document");
    assert.ok(
      docxExportPost.responses["403"],
      "expected DOCX export route to document a 403 response",
    );
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

  it("self-heals provisioning from Clerk when the local account is missing", async () => {
    const context = createMemoryAppContext();
    context.getClerkUserById = async (clerkUserId) => ({
      id: clerkUserId,
      primaryEmailAddressId: "email_1",
      emailAddresses: [
        {
          id: "email_1",
          emailAddress: "selfheal@example.com",
        },
      ],
      firstName: "Self",
      lastName: "Heal",
      username: null,
      imageUrl: null,
    });
    const app = createApp(context);

    const response = await app.request("http://localhost/v1/me", {
      headers: {
        "x-test-user-id": "user_self_heal",
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.user.email, "selfheal@example.com");
    assert.equal(payload.plan.code, "free");
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

    const badBootstrap = await app.request(
      "http://localhost/v1/documents/bootstrap",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({
          title: "Mismatched template",
          type: "skripsi",
          templateCode: "proposal",
        }),
      },
    );

    assert.equal(badBootstrap.status, 400);
    assert.equal((await badBootstrap.json()).code, "bad_request");

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

describe("launch funnel analytics", () => {
  it("emits launch events for create, template bootstrap, outline, and AI actions", async () => {
    const app = createApp(createMemoryAppContext());
    const clerkId = "user_launch_events";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(createClerkUserEvent("user.created", { id: clerkId })),
    });

    const meResponse = await app.request("http://localhost/v1/me", {
      headers: {
        "x-test-user-id": clerkId,
      },
    });
    const mePayload = await meResponse.json();

    const authHeaders = {
      "content-type": "application/json",
      "x-test-user-id": clerkId,
    };

    const { result: createResponse, events: createEvents } =
      await captureLaunchEvents(() =>
        app.request("http://localhost/v1/documents", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            title: "Launch Analytics Doc",
            type: "general_paper",
          }),
        }),
      );
    const createdPayload = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createdPayload.document.title, "Launch Analytics Doc");
    assert.equal(createEvents.at(0)?.event, "document.created");
    assert.equal(createEvents.at(0)?.documentId, createdPayload.document.id);
    assert.equal(createEvents.at(0)?.userId, mePayload.user.id);

    const { result: bootstrapResponse, events: bootstrapEvents } =
      await captureLaunchEvents(() =>
        app.request("http://localhost/v1/documents/bootstrap", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            title: "Bootstrapped Doc",
            type: "general_paper",
            templateCode: "general_paper",
          }),
        }),
      );
    const bootstrapPayload = await bootstrapResponse.json();

    assert.equal(bootstrapResponse.status, 201);
    assert.deepEqual(
      bootstrapEvents.map((event) => event.event),
      ["template.selected", "document.bootstrap_completed"],
    );
    assert.equal(bootstrapEvents.at(0)?.documentId, bootstrapPayload.document.id);
    assert.equal(bootstrapEvents.at(0)?.templateCode, "general_paper");

    const { result: outlineResponse, events: outlineEvents } =
      await captureLaunchEvents(() =>
        app.request(
          `http://localhost/v1/documents/${createdPayload.document.id}/outline/generate`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              topic: "Meningkatkan produktivitas penulisan akademik",
              idempotencyKey: "idem-outline-launch",
            }),
          },
        ),
      );
    const outlinePayload = await outlineResponse.json();

    assert.equal(outlineResponse.status, 200);
    assert.equal(outlineEvents.at(0)?.event, "outline.generated");
    assert.equal(outlineEvents.at(0)?.documentId, createdPayload.document.id);
    assert.equal(outlineEvents.at(0)?.isReplay, false);
    assert.ok(outlinePayload.outline.title.length > 0);

    const saveResponse = await app.request(
      `http://localhost/v1/documents/${createdPayload.document.id}/content`,
      {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          contentJson: [
            {
              type: "paragraph",
              id: "launch-block-1",
              children: [{ text: "Kerangka awal tulisan." }],
            },
          ],
          baseUpdatedAt: createdPayload.document.updatedAt,
        }),
      },
    );
    const savedPayload = await saveResponse.json();
    assert.equal(saveResponse.status, 200);

    const { result: proposalResponse, events: proposalEvents } =
      await captureLaunchEvents(() =>
        app.request(
          `http://localhost/v1/documents/${createdPayload.document.id}/ai/proposals`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              action: "rewrite",
              targetBlockIds: ["launch-block-1"],
              idempotencyKey: "idem-proposal-launch",
            }),
          },
        ),
      );
    const proposalPayload = await proposalResponse.json();

    assert.equal(proposalResponse.status, 200);
    assert.equal(proposalEvents.at(0)?.event, "ai.proposal_requested");
    assert.equal(
      proposalEvents.at(0)?.proposalId,
      proposalPayload.proposal.id,
    );

    const { result: applyResponse, events: applyEvents } =
      await captureLaunchEvents(() =>
        app.request(
          `http://localhost/v1/ai/proposals/${proposalPayload.proposal.id}/apply`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              baseUpdatedAt: savedPayload.document.updatedAt,
              mode: "replace",
            }),
          },
        ),
      );
    const applyPayload = await applyResponse.json();

    assert.equal(applyResponse.status, 200);
    assert.equal(applyEvents.at(0)?.event, "ai.proposal_applied");
    assert.equal(applyEvents.at(0)?.mode, "replace");
    assert.equal(applyPayload.proposal.status, "applied");

    const { result: dismissResponse, events: dismissEvents } =
      await captureLaunchEvents(() =>
        app.request(
          `http://localhost/v1/ai/proposals/${proposalPayload.proposal.id}/dismiss`,
          {
            method: "POST",
            headers: authHeaders,
          },
        ),
      );
    const dismissPayload = await dismissResponse.json();

    assert.equal(dismissResponse.status, 200);
    assert.equal(dismissEvents.at(0)?.event, "ai.proposal_dismissed");
    assert.equal(
      dismissEvents.at(0)?.proposalId,
      proposalPayload.proposal.id,
    );
    assert.equal(dismissPayload.proposal.id, proposalPayload.proposal.id);
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

describe("AI validation", () => {
  it("rejects ai proposal generation when target block ids are stale", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_invalid_target";

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
    const { document } = await createRes.json();

    const res = await app.request(
      `http://localhost/v1/documents/${document.id}/ai/proposals`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({
          action: "rewrite",
          targetBlockIds: ["missing-block"],
          idempotencyKey: "invalid-target-test",
        }),
      },
    );

    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, "invalid_target");
  });
});

describe("API error events", () => {
  it("emits an error_event for unauthenticated session access", async () => {
    const app = createApp(createMemoryAppContext());

    const { result: response, events } = await captureErrorEvents(() =>
      app.request("http://localhost/v1/me"),
    );

    assert.equal(response.status, 401);
    const event = events.at(-1);
    assert.equal(event?.domain, "auth");
    assert.equal(event?.failureClass, "user");
    assert.equal(event?.code, "unauthorized");
    assert.equal(event?.path, "/v1/me");
  });

  it("emits an error_event for unhandled AI failures", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_error_event_ai";

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
    const { document } = await createRes.json();

    const originalGenerateOutlineDraft = context.aiService.generateOutlineDraft;
    context.aiService.generateOutlineDraft = async () => {
      throw new Error("Provider downstream failure");
    };

    try {
      const { result: response, events } = await captureErrorEvents(() =>
        app.request(
          `http://localhost/v1/documents/${document.id}/outline/generate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-test-user-id": clerkId,
            },
            body: JSON.stringify({
              topic: "Some topic",
              idempotencyKey: "idem-error-event-ai",
            }),
          },
        ),
      );

      assert.equal(response.status, 500);
      const event = events.at(-1);
      assert.equal(event?.type, "error_event");
      assert.equal(event?.domain, "ai");
      assert.equal(event?.failureClass, "system");
      assert.equal(event?.code, "unhandled_api_error");
      assert.equal(
        event?.path,
        `/v1/documents/${document.id}/outline/generate`,
      );
      assert.equal(event?.requestId, "local");
      assert.equal(event?.message, "Provider downstream failure");
      assert.equal(typeof event?.ts, "string");
    } finally {
      context.aiService.generateOutlineDraft = originalGenerateOutlineDraft;
    }
  });

  it("emits an error_event for stale document saves", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_error_event_save";

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
    const { document } = await createRes.json();

    const firstSave = await app.request(
      `http://localhost/v1/documents/${document.id}/content`,
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
          baseUpdatedAt: document.updatedAt,
        }),
      },
    );

    assert.equal(firstSave.status, 200);
    const staleBaseUpdatedAt = new Date(
      new Date(document.updatedAt).getTime() - 1000,
    ).toISOString();

    const { result: staleSaveResponse, events } = await captureErrorEvents(() =>
      app.request(`http://localhost/v1/documents/${document.id}/content`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({
          contentJson: [
            { type: "paragraph", id: "b1", children: [{ text: "Stale" }] },
          ],
          baseUpdatedAt: staleBaseUpdatedAt,
        }),
      }),
    );

    assert.equal(staleSaveResponse.status, 409);
    const event = events.at(-1);
    assert.equal(event?.type, "error_event");
    assert.equal(event?.domain, "document_save");
    assert.equal(event?.failureClass, "user");
    assert.equal(event?.code, "stale_document_save");
    assert.equal(event?.path, `/v1/documents/${document.id}/content`);
    assert.equal(event?.requestId, "local");
    assert.equal(event?.documentId, document.id);
    assert.equal(typeof event?.ts, "string");
  });

  it("emits an error_event for export queue unavailability", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_error_event_export";

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
    const { document } = await createRes.json();

    const originalRequestDocxExport = context.services.exports.requestDocxExport;
    context.services.exports.requestDocxExport = async () => ({
      type: "queue_unavailable",
      message: "Redis unavailable",
    });

    try {
      const { result: response, events } = await captureErrorEvents(() =>
        app.request(
          `http://localhost/v1/documents/${document.id}/exports/docx`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-test-user-id": clerkId,
            },
            body: JSON.stringify({ idempotencyKey: "idem-error-event-export" }),
          },
        ),
      );

      assert.equal(response.status, 503);
      const event = events.at(-1);
      assert.equal(event?.type, "error_event");
      assert.equal(event?.domain, "export");
      assert.equal(event?.failureClass, "system");
      assert.equal(event?.code, "queue_unavailable");
      assert.equal(event?.path, `/v1/documents/${document.id}/exports/docx`);
      assert.equal(event?.requestId, "local");
      assert.equal(event?.documentId, document.id);
      assert.equal(event?.message, "Export queue is temporarily unavailable");
      assert.equal(typeof event?.ts, "string");
    } finally {
      context.services.exports.requestDocxExport = originalRequestDocxExport;
    }
  });

  it("emits an error_event for export workspace mismatches", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const ownerClerkId = "user_error_event_export_owner";
    const intruderClerkId = "user_error_event_export_intruder";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: ownerClerkId }),
      ),
    });
    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: intruderClerkId }),
      ),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": ownerClerkId,
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document } = await createRes.json();

    const { result: response, events } = await captureErrorEvents(() =>
      app.request(`http://localhost/v1/documents/${document.id}/exports/docx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": intruderClerkId,
        },
        body: JSON.stringify({
          idempotencyKey: "idem-error-event-export-forbidden",
        }),
      }),
    );

    assert.equal(response.status, 403);
    const event = events.at(-1);
    assert.equal(event?.domain, "export");
    assert.equal(event?.failureClass, "user");
    assert.equal(event?.code, "workspace_mismatch");
    assert.equal(event?.documentId, document.id);
  });

  it("emits an error_event for retry queue unavailability", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_error_event_export_retry";
    const exportId = "exp-error-event-retry";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: clerkId }),
      ),
    });

    const originalRetryExport = context.services.exports.retryExport;
    context.services.exports.retryExport = async () => ({
      type: "queue_unavailable",
      message: "Redis unavailable",
    });

    try {
      const { result: response, events } = await captureErrorEvents(() =>
        app.request(`http://localhost/v1/exports/${exportId}/retry`, {
          method: "POST",
          headers: {
            "x-test-user-id": clerkId,
          },
        }),
      );

      assert.equal(response.status, 503);
      const event = events.at(-1);
      assert.equal(event?.domain, "export");
      assert.equal(event?.failureClass, "system");
      assert.equal(event?.code, "queue_unavailable");
      assert.equal(event?.exportId, exportId);
      assert.equal(event?.message, "Export queue is temporarily unavailable");
    } finally {
      context.services.exports.retryExport = originalRetryExport;
    }
  });

  it("emits an error_event when a ready export file cannot be read", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_error_event_export_download";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: clerkId }),
      ),
    });

    const meRes = await app.request("http://localhost/v1/me", {
      headers: { "x-test-user-id": clerkId },
    });
    const { user } = await meRes.json();

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": clerkId,
      },
      body: JSON.stringify({ title: "Target", type: "general_paper" }),
    });
    const { document } = await createRes.json();

    const post = await app.request(
      `http://localhost/v1/documents/${document.id}/exports/docx`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({ idempotencyKey: "idem-error-event-download" }),
      },
    );
    const { export: exp } = await post.json();

    const mem = context.repository as unknown as MemoryRepository;
    const row = mem.state.exports.find((item) => item.id === exp.id);
    assert.ok(row);
    row.storageKey = createStorageKey("exports", user.id, `${exp.id}.docx`);
    row.status = "ready";
    row.contentType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const { result: response, events } = await captureErrorEvents(() =>
      app.request(`http://localhost/v1/exports/${exp.id}/download`, {
        headers: {
          "x-test-user-id": clerkId,
        },
      }),
    );

    assert.equal(response.status, 404);
    const event = events.at(-1);
    assert.equal(event?.domain, "export");
    assert.equal(event?.failureClass, "system");
    assert.equal(event?.code, "export_file_read_failed");
    assert.equal(event?.exportId, exp.id);
  });

  it("emits an error_event when export quota is exhausted", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_error_event_export_quota";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: clerkId }),
      ),
    });

    const meRes = await app.request("http://localhost/v1/me", {
      headers: { "x-test-user-id": clerkId },
    });
    const { user } = await meRes.json();
    const period = getCurrentBillingPeriod();

    const mem = context.repository as unknown as MemoryRepository;
    mem.state.monthlyUsageCounters.push({
      id: randomUUID(),
      userId: user.id,
      period,
      aiActionsUsed: 0,
      sourceUploadsUsed: 0,
      exportsUsed: PLAN_LIMITS.free.exportsLimit,
      storageUsedBytes: 0,
      updatedAt: new Date().toISOString(),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": clerkId,
      },
      body: JSON.stringify({ title: "Quota", type: "general_paper" }),
    });
    const { document } = await createRes.json();

    const { result: response, events } = await captureErrorEvents(() =>
      app.request(`http://localhost/v1/documents/${document.id}/exports/docx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({ idempotencyKey: "idem-error-event-quota" }),
      }),
    );

    assert.equal(response.status, 429);
    const event = events.at(-1);
    assert.equal(event?.domain, "export");
    assert.equal(event?.failureClass, "user");
    assert.equal(event?.code, "export_quota_exceeded");
    assert.equal(event?.documentId, document.id);
  });
});

describe("DOCX exports API", () => {
  it("queues a DOCX export with preflight metadata and supports idempotent replay", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_export_queue_1";

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
      body: JSON.stringify({ title: "My Paper", type: "general_paper" }),
    });
    const { document: doc } = await createRes.json();

    const post1 = await app.request(
      `http://localhost/v1/documents/${doc.id}/exports/docx`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({ idempotencyKey: "idem-exp-1" }),
      },
    );

    assert.equal(post1.status, 200);
    const j1 = await post1.json();
    assert.equal(j1.export.status, "queued");
    assert.equal(j1.isReplay, false);
    assert.ok(Array.isArray(j1.preflightWarnings));

    const post2 = await app.request(
      `http://localhost/v1/documents/${doc.id}/exports/docx`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({ idempotencyKey: "idem-exp-1" }),
      },
    );

    assert.equal(post2.status, 200);
    const j2 = await post2.json();
    assert.equal(j2.isReplay, true);
    assert.equal(j2.export.id, j1.export.id);
  });

  it("returns export file download when status is ready and storage exists", async () => {
    const prevDir = process.env.AQSHARA_EXPORTS_DIR;
    const dir = mkdtempSync(join(tmpdir(), "aqshara-export-test-"));
    process.env.AQSHARA_EXPORTS_DIR = dir;

    try {
      const context = createMemoryAppContext();
      const app = createApp(context);
      const clerkId = "user_export_dl_1";

      await app.request("http://localhost/webhooks/clerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createClerkUserEvent("user.created", { id: clerkId }),
        ),
      });

      const meRes = await app.request("http://localhost/v1/me", {
        headers: { "x-test-user-id": clerkId },
      });
      const { user } = await meRes.json();

      const createRes = await app.request("http://localhost/v1/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({ title: "DL Test", type: "general_paper" }),
      });
      const { document: doc } = await createRes.json();

      const post = await app.request(
        `http://localhost/v1/documents/${doc.id}/exports/docx`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-test-user-id": clerkId,
          },
          body: JSON.stringify({ idempotencyKey: "idem-dl-1" }),
        },
      );
      const { export: exp } = await post.json();

      const mem = context.repository as unknown as MemoryRepository;
      const row = mem.state.exports.find((e) => e.id === exp.id);
      assert.ok(row);
      const key = createStorageKey("exports", user.id, `${exp.id}.docx`);
      row.storageKey = key;
      row.status = "ready";
      row.contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      await writeExportFile(key, Buffer.from("PK\x03\x04fake"));

      const dl = await app.request(
        `http://localhost/v1/exports/${exp.id}/download`,
        {
          headers: { "x-test-user-id": clerkId },
        },
      );

      assert.equal(dl.status, 200);
      const buf = Buffer.from(await dl.arrayBuffer());
      assert.equal(buf.toString("utf8"), "PK\x03\x04fake");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      process.env.AQSHARA_EXPORTS_DIR = prevDir;
    }
  });

  it("returns 429 when monthly export quota is exhausted", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_export_quota_1";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: clerkId }),
      ),
    });

    const meRes = await app.request("http://localhost/v1/me", {
      headers: { "x-test-user-id": clerkId },
    });
    const { user } = await meRes.json();
    const period = getCurrentBillingPeriod();

    const mem = context.repository as unknown as MemoryRepository;
    mem.state.monthlyUsageCounters.push({
      id: randomUUID(),
      userId: user.id,
      period,
      aiActionsUsed: 0,
      sourceUploadsUsed: 0,
      exportsUsed: PLAN_LIMITS.free.exportsLimit,
      storageUsedBytes: 0,
      updatedAt: new Date().toISOString(),
    });

    const createRes = await app.request("http://localhost/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": clerkId,
      },
      body: JSON.stringify({ title: "Quota", type: "general_paper" }),
    });
    const { document: doc } = await createRes.json();

    const post = await app.request(
      `http://localhost/v1/documents/${doc.id}/exports/docx`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({ idempotencyKey: "idem-quota-1" }),
      },
    );

    assert.equal(post.status, 429);
    const body = await post.json();
    assert.equal(body.code, "export_quota_exceeded");
  });

  it("retries a failed export and returns queued status", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_export_retry_1";

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
      body: JSON.stringify({ title: "Retry", type: "general_paper" }),
    });
    const { document: doc } = await createRes.json();

    const post = await app.request(
      `http://localhost/v1/documents/${doc.id}/exports/docx`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({ idempotencyKey: "idem-retry-1" }),
      },
    );
    const { export: exp } = await post.json();

    const mem = context.repository as unknown as MemoryRepository;
    const row = mem.state.exports.find((e) => e.id === exp.id)!;
    row.status = "failed";
    row.errorCode = "test_failure";
    row.errorMessage = "simulated";

    const retryRes = await app.request(
      `http://localhost/v1/exports/${exp.id}/retry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
      },
    );

    assert.equal(retryRes.status, 200);
    const retryBody = await retryRes.json();
    assert.equal(retryBody.export.status, "queued");
    assert.equal(retryBody.export.retryCount, 1);
  });
});

describe("sources API", () => {
  it("returns a source upload target when the source service issues one", async () => {
    const context = createMemoryAppContext();
    const app = createApp(context);
    const clerkId = "user_sources_upload_url_1";

    await app.request("http://localhost/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createClerkUserEvent("user.created", { id: clerkId }),
      ),
    });

    const originalCreateUploadUrl = context.services.sources.createUploadUrl;
    context.services.sources.createUploadUrl = async () => ({
      type: "ok",
      sourceId: "src-upload-1",
      storageKey: "sources/ws/src-upload-1/original.pdf",
      uploadUrl: "https://example.test/upload",
      expiresInSeconds: 900,
    });

    try {
      const response = await app.request("http://localhost/v1/sources/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({}),
      });

      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        sourceId: string;
        storageKey: string;
        uploadUrl: string;
        expiresInSeconds: number;
      };
      assert.equal(body.sourceId, "src-upload-1");
      assert.equal(body.storageKey, "sources/ws/src-upload-1/original.pdf");
      assert.equal(body.uploadUrl, "https://example.test/upload");
      assert.equal(body.expiresInSeconds, 900);
    } finally {
      context.services.sources.createUploadUrl = originalCreateUploadUrl;
    }
  });

  it("returns a frontend-safe source status payload without internal storage fields", async () => {
    const dir = mkdtempSync(join(tmpdir(), "aqshara-sources-"));
    const prevDir = process.env.AQSHARA_SOURCES_DIR;
    process.env.AQSHARA_SOURCES_DIR = dir;

    try {
      const context = createMemoryAppContext();
      const app = createApp(context);
      const clerkId = "user_sources_status_1";

      await app.request("http://localhost/webhooks/clerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createClerkUserEvent("user.created", { id: clerkId }),
        ),
      });

      const meRes = await app.request("http://localhost/v1/me", {
        headers: { "x-test-user-id": clerkId },
      });
      const {
        user,
        workspace,
      } = (await meRes.json()) as {
        user: { id: string };
        workspace: { id: string };
      };
      void user;

      const createRes = await app.request("http://localhost/v1/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({ title: "Source Doc", type: "general_paper" }),
      });
      const { document: doc } = (await createRes.json()) as {
        document: { id: string };
      };

      const sourceId = randomUUID();
      const storageKey = sourceOriginalKey(workspace.id, sourceId);
      const fullPath = join(getSourcesRootDir(), storageKey);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, MINIMAL_PDF_BUFFER);

      const registerRes = await app.request("http://localhost/v1/sources/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({
          documentId: doc.id,
          sourceId,
          storageKey,
          originalFileName: "paper.pdf",
          fileSizeBytes: MINIMAL_PDF_BUFFER.length,
          checksum: sha256Hex(MINIMAL_PDF_BUFFER),
          mimeType: "application/pdf",
          idempotencyKey: "src-route-1",
        }),
      });
      assert.equal(registerRes.status, 200);

      const statusRes = await app.request(
        `http://localhost/v1/sources/${sourceId}/status`,
        {
          headers: { "x-test-user-id": clerkId },
        },
      );
      assert.equal(statusRes.status, 200);
      const statusBody = (await statusRes.json()) as {
        source: Record<string, unknown>;
      };

      assert.equal(statusBody.source.id, sourceId);
      assert.equal(statusBody.source.status, "queued");
      assert.equal(statusBody.source.originalFileName, "paper.pdf");
      assert.ok(!("storageKey" in statusBody.source));
      assert.ok(!("checksum" in statusBody.source));
      assert.ok(!("bullmqJobId" in statusBody.source));
      assert.ok(!("idempotencyKey" in statusBody.source));
    } finally {
      if (prevDir === undefined) {
        delete process.env.AQSHARA_SOURCES_DIR;
      } else {
        process.env.AQSHARA_SOURCES_DIR = prevDir;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("retries failed sources and deletes them cleanly", async () => {
    const dir = mkdtempSync(join(tmpdir(), "aqshara-sources-"));
    const prevDir = process.env.AQSHARA_SOURCES_DIR;
    process.env.AQSHARA_SOURCES_DIR = dir;

    try {
      const context = createMemoryAppContext();
      const app = createApp(context);
      const clerkId = "user_sources_retry_1";

      await app.request("http://localhost/webhooks/clerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createClerkUserEvent("user.created", { id: clerkId }),
        ),
      });

      const meRes = await app.request("http://localhost/v1/me", {
        headers: { "x-test-user-id": clerkId },
      });
      const { workspace } = (await meRes.json()) as {
        workspace: { id: string };
      };

      const createRes = await app.request("http://localhost/v1/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({ title: "Retry Source", type: "general_paper" }),
      });
      const { document: doc } = (await createRes.json()) as {
        document: { id: string };
      };

      const sourceId = randomUUID();
      const storageKey = sourceOriginalKey(workspace.id, sourceId);
      const fullPath = join(getSourcesRootDir(), storageKey);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, MINIMAL_PDF_BUFFER);

      const registerRes = await app.request("http://localhost/v1/sources/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user-id": clerkId,
        },
        body: JSON.stringify({
          documentId: doc.id,
          sourceId,
          storageKey,
          originalFileName: "retry.pdf",
          fileSizeBytes: MINIMAL_PDF_BUFFER.length,
          checksum: sha256Hex(MINIMAL_PDF_BUFFER),
          mimeType: "application/pdf",
          idempotencyKey: "src-route-2",
        }),
      });
      assert.equal(registerRes.status, 200);

      const mem = context.repository as unknown as MemoryRepository;
      const row = mem.state.sources.find((source) => source.id === sourceId);
      assert.ok(row);
      row.status = "failed";
      row.errorCode = "storage_read_failed";
      row.errorMessage = "simulated";

      const retryRes = await app.request(
        `http://localhost/v1/sources/${sourceId}/retry`,
        {
          method: "POST",
          headers: { "x-test-user-id": clerkId },
        },
      );
      assert.equal(retryRes.status, 200);
      const retryBody = (await retryRes.json()) as {
        source: { status: string; retryCount: number };
      };
      assert.equal(retryBody.source.status, "queued");
      assert.equal(retryBody.source.retryCount, 1);

      const deleteRes = await app.request(
        `http://localhost/v1/sources/${sourceId}`,
        {
          method: "DELETE",
          headers: { "x-test-user-id": clerkId },
        },
      );
      assert.equal(deleteRes.status, 204);

      const statusRes = await app.request(
        `http://localhost/v1/sources/${sourceId}/status`,
        {
          headers: { "x-test-user-id": clerkId },
        },
      );
      assert.equal(statusRes.status, 404);
    } finally {
      if (prevDir === undefined) {
        delete process.env.AQSHARA_SOURCES_DIR;
      } else {
        process.env.AQSHARA_SOURCES_DIR = prevDir;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
