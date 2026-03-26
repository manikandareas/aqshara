import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { processSourceParseJob } from "./source-parse.js";

const payload = {
  sourceId: "source-1",
  documentId: "document-1",
  userId: "user-1",
  workspaceId: "workspace-1",
  idempotencyKey: "idem-1",
} as const;

type JobState = {
  id: string;
  userId: string;
  workspaceId: string;
  storageKey: string;
  status: "queued" | "processing" | "ready" | "failed";
  bullmqJobId: string | null;
};

describe("processSourceParseJob", () => {
  it("stores parsed text and marks the source ready", async () => {
    const calls: {
      putSourceObject?: { key: string; body: string; contentType: string };
      markSourceReady?: {
        sourceId: string;
        parsedTextStorageKey: string;
        pageCount: number;
        parsedTextSizeBytes: number;
      };
      launchEvents: string[];
    } = {
      launchEvents: [],
    };

    await processSourceParseJob(
      payload,
      "job-1",
      undefined,
      {
        createDatabase: () => ({ tag: "db" }),
        getSourceJobRow: async () => ({
          id: payload.sourceId,
          userId: payload.userId,
          workspaceId: payload.workspaceId,
          storageKey: "sources/workspace-1/source-1/original.pdf",
          status: "queued",
          bullmqJobId: null,
        }),
        getDocumentRow: async () => ({ workspaceId: payload.workspaceId }),
        getDocumentSourceLinkRow: async () => ({ id: "link-1" }),
        markSourceProcessing: async () => ({ id: payload.sourceId }),
        getSourceObjectBuffer: async () => Buffer.from("%PDF"),
        extractPdfPageTexts: async () => ({
          numPages: 1,
          pages: ["Hello from the embedded PDF text, enough to skip OCR."],
        }),
        pageIndicesNeedingOcr: () => [],
        putSourceObject: async (input: {
          key: string;
          body: Buffer;
          contentType: string;
        }) => {
          calls.putSourceObject = {
            key: input.key,
            body: input.body.toString("utf8"),
            contentType: input.contentType,
          };
        },
        markSourceReady: async (
          _db: unknown,
          input: {
            sourceId: string;
            parsedTextStorageKey: string;
            pageCount: number;
            parsedTextSizeBytes: number;
          },
        ) => {
          calls.markSourceReady = input;
          return { ok: true as const };
        },
        logLaunchEvent: (event: string) => {
          calls.launchEvents.push(event);
        },
      },
    );

    assert.deepEqual(calls.putSourceObject, {
      key: "sources/workspace-1/source-1/parsed.txt",
      body: "## Page 1\n\nHello from the embedded PDF text, enough to skip OCR.",
      contentType: "text/plain; charset=utf-8",
    });
    assert.deepEqual(calls.markSourceReady, {
      sourceId: payload.sourceId,
      parsedTextStorageKey: "sources/workspace-1/source-1/parsed.txt",
      pageCount: 1,
      parsedTextSizeBytes:
        "## Page 1\n\nHello from the embedded PDF text, enough to skip OCR."
          .length,
    });
    assert.deepEqual(calls.launchEvents, ["source.parse_ready"]);
  });

  it("continues a retry attempt when the same BullMQ job is already processing", async () => {
    const states: JobState[] = [
      {
        id: payload.sourceId,
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        storageKey: "sources/workspace-1/source-1/original.pdf",
        status: "queued",
        bullmqJobId: null,
      },
      {
        id: payload.sourceId,
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        storageKey: "sources/workspace-1/source-1/original.pdf",
        status: "processing",
        bullmqJobId: "job-1",
      },
    ];
    let sourceLookupCount = 0;
    let readyMarked = false;

    await processSourceParseJob(
      payload,
      "job-1",
      { attemptsMade: 1, maxAttempts: 3 },
      {
        createDatabase: () => ({ tag: "db" }),
        getSourceJobRow: async () => {
          const index = Math.min(sourceLookupCount, states.length - 1);
          sourceLookupCount += 1;
          return states[index] ?? null;
        },
        getDocumentRow: async () => ({ workspaceId: payload.workspaceId }),
        getDocumentSourceLinkRow: async () => ({ id: "link-1" }),
        markSourceProcessing: async () => null,
        getSourceObjectBuffer: async () => Buffer.from("%PDF"),
        extractPdfPageTexts: async () => ({
          numPages: 1,
          pages: ["Retry path text stays processable after transition replay."],
        }),
        pageIndicesNeedingOcr: () => [],
        putSourceObject: async () => undefined,
        markSourceReady: async () => {
          readyMarked = true;
          return { ok: true as const };
        },
      },
    );

    assert.equal(sourceLookupCount >= 2, true);
    assert.equal(readyMarked, true);
  });
});
