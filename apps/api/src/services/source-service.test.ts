import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { getSourcesRootDir, sourceOriginalKey } from "@aqshara/storage";
import { MemoryRepository } from "../test-support/memory-app-context.js";
import { SourceService } from "./source-service.js";

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

describe("SourceService", () => {
  it("registers a local object and enqueues parse when storage head succeeds", async () => {
    const repository = new MemoryRepository();
    const { user, workspace } = await repository.upsertUserFromWebhook({
      clerkUserId: "user_source_service_1",
      email: "src@example.com",
      name: "Source User",
      avatarUrl: null,
    });

    const document = await repository.createDocument({
      userId: user.id,
      title: "Paper",
      type: "general_paper",
    });

    const sourceId = randomUUID();
    const storageKey = sourceOriginalKey(workspace.id, sourceId);
    const fullPath = join(getSourcesRootDir(), storageKey);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, MINIMAL_PDF_BUFFER);

    let enqueued = 0;
    const service = new SourceService(repository, async () => {
      enqueued += 1;
      return { jobId: `job-${enqueued}` };
    });

    const result = await service.registerSource({
      userId: user.id,
      workspaceId: workspace.id,
      documentId: document.id,
      sourceId,
      storageKey,
      originalFileName: "paper.pdf",
      fileSizeBytes: MINIMAL_PDF_BUFFER.length,
      checksum: sha256Hex(MINIMAL_PDF_BUFFER),
      mimeType: "application/pdf",
      idempotencyKey: "src-reg-1",
    });

    assert.equal(result.type, "ok");
    if (result.type === "ok") {
      assert.equal(result.source.status, "queued");
      assert.equal(result.source.bullmqJobId, "job-1");
      assert.equal(result.relinked, false);
    }
    assert.equal(enqueued, 1);
  });

  it("returns workspace_mismatch when upload-url workspace does not match the user workspace", async () => {
    const repository = new MemoryRepository();
    const { user } = await repository.upsertUserFromWebhook({
      clerkUserId: "user_source_service_2",
      email: "src2@example.com",
      name: "Source User 2",
      avatarUrl: null,
    });

    const service = new SourceService(repository, async () => ({
      jobId: "j",
    }));

    const result = await service.createUploadUrl({
      userId: user.id,
      workspaceId: randomUUID(),
    });

    assert.equal(result.type, "workspace_mismatch");
  });

  it("relinks to an existing ready source with the same checksum", async () => {
    const repository = new MemoryRepository();
    const { user, workspace } = await repository.upsertUserFromWebhook({
      clerkUserId: "user_source_service_3",
      email: "src3@example.com",
      name: "Source User 3",
      avatarUrl: null,
    });

    const document = await repository.createDocument({
      userId: user.id,
      title: "Paper",
      type: "general_paper",
    });

    const existingSourceId = randomUUID();
    const checksum = sha256Hex(MINIMAL_PDF_BUFFER);
    repository.state.sources.push({
      id: existingSourceId,
      workspaceId: workspace.id,
      userId: user.id,
      billingPeriod: "2026-03",
      status: "ready",
      storageKey: sourceOriginalKey(workspace.id, existingSourceId),
      parsedTextStorageKey: null,
      parsedTextSizeBytes: null,
      mimeType: "application/pdf",
      originalFileName: "existing.pdf",
      fileSizeBytes: MINIMAL_PDF_BUFFER.length,
      checksum,
      pageCount: 1,
      bullmqJobId: null,
      retryCount: 0,
      errorMessage: null,
      errorCode: null,
      processingStartedAt: null,
      readyAt: new Date().toISOString(),
      idempotencyKey: null,
      deletedAt: null,
      createdAt: new Date(Date.now() - 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1000).toISOString(),
    });

    let enqueued = 0;
    const service = new SourceService(repository, async () => {
      enqueued += 1;
      return { jobId: `job-${enqueued}` };
    });

    const sourceId = randomUUID();
    const storageKey = sourceOriginalKey(workspace.id, sourceId);
    const fullPath = join(getSourcesRootDir(), storageKey);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, MINIMAL_PDF_BUFFER);

    const result = await service.registerSource({
      userId: user.id,
      workspaceId: workspace.id,
      documentId: document.id,
      sourceId,
      storageKey,
      originalFileName: "paper.pdf",
      fileSizeBytes: MINIMAL_PDF_BUFFER.length,
      checksum,
      mimeType: "application/pdf",
      idempotencyKey: "src-reg-relink",
    });

    assert.equal(result.type, "ok");
    if (result.type === "ok") {
      assert.equal(result.relinked, true);
      assert.equal(result.source.id, existingSourceId);
    }
    assert.equal(enqueued, 0);
  });
});
