import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryRepository } from "../test-support/memory-app-context.js";
import { ExportService } from "./export-service.js";

describe("ExportService", () => {
  it("preflights document warnings without creating export jobs", async () => {
    const repository = new MemoryRepository();
    const { user, workspace } = await repository.upsertUserFromWebhook({
      clerkUserId: "user_export_service_preflight",
      email: "user@example.com",
      name: "Export User",
      avatarUrl: null,
    });

    const document = await repository.createDocument({
      userId: user.id,
      title: "  ",
      type: "general_paper",
    });

    const storedDocument = repository.state.documents.find(
      (entry) => entry.id === document.id,
    );
    if (!storedDocument) {
      throw new Error("Document missing from memory repository");
    }
    storedDocument.contentJson = [
      {
        type: "paragraph",
        id: "b1",
        children: [{ text: "TODO" }],
      },
    ];
    storedDocument.plainText = "TODO";

    const service = new ExportService(repository, async () => ({
      jobId: "job-preflight",
    }));

    const result = await service.preflightDocxExport({
      userId: user.id,
      workspaceId: workspace.id,
      documentId: document.id,
    });

    assert.equal(result.type, "ok");
    if (result.type === "ok") {
      assert.ok(result.warnings.length >= 1);
    }

    const exportsAfterPreflight = await repository.listExportsForUser({
      userId: user.id,
      limit: 10,
    });
    assert.equal(exportsAfterPreflight.length, 0);
  });

  it("re-enqueues the same idempotency key after a queue enqueue failure", async () => {
    const repository = new MemoryRepository();
    const { user, workspace } = await repository.upsertUserFromWebhook({
      clerkUserId: "user_export_service_1",
      email: "user@example.com",
      name: "Export User",
      avatarUrl: null,
    });

    const document = await repository.createDocument({
      userId: user.id,
      title: "Retryable export",
      type: "general_paper",
    });

    let enqueueCalls = 0;
    const service = new ExportService(repository, async () => {
      enqueueCalls += 1;

      if (enqueueCalls === 1) {
        throw new Error("Redis unavailable");
      }

      return { jobId: `job-${enqueueCalls}` };
    });

    const firstAttempt = await service.requestDocxExport({
      userId: user.id,
      workspaceId: workspace.id,
      documentId: document.id,
      idempotencyKey: "export-idem-1",
    });

    assert.equal(firstAttempt.type, "queue_unavailable");

    const secondAttempt = await service.requestDocxExport({
      userId: user.id,
      workspaceId: workspace.id,
      documentId: document.id,
      idempotencyKey: "export-idem-1",
    });

    assert.equal(secondAttempt.type, "ok");
    assert.equal(secondAttempt.isReplay, false);
    assert.equal(secondAttempt.export.status, "queued");
    assert.equal(secondAttempt.export.bullmqJobId, "job-2");
    assert.equal(secondAttempt.export.errorCode, null);
    assert.equal(enqueueCalls, 2);
  });
});
