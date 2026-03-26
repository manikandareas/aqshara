import test from "node:test";
import assert from "node:assert";
import type { ParagraphElement } from "@aqshara/documents";
import type { AiProvider } from "./types.js";
import { AiService } from "./service.js";
import { FakeAiProvider } from "./provider.js";

test("AiService - generateOutlineDraft", async () => {
  const provider = new FakeAiProvider();
  const service = new AiService(provider);

  const draft = await service.generateOutlineDraft({
    action: "outline",
    topic: "Test Topic",
  });

  assert.strictEqual(draft.title, "Fake Outline");
  assert.strictEqual(draft.nodes.length, 2);
});

test("AiService - generateOutlineDraft with unsupported action", async () => {
  const provider = new FakeAiProvider();
  let providerCalled = false;
  const trackingProvider: AiProvider = {
    generateText: async (systemPrompt, userPrompt, action) => {
      providerCalled = true;
      return provider.generateText(systemPrompt, userPrompt, action);
    },
  };
  const service = new AiService(trackingProvider);

  await assert.rejects(
    () =>
      service.generateOutlineDraft({
        action: "continue" as unknown as "outline",
        topic: "Test Topic",
      }),
    /Unsupported action for outline: continue/,
  );

  assert.strictEqual(
    providerCalled,
    false,
    "Provider should not be called for unsupported action",
  );
});

test("AiService - generateWritingProposal for all valid actions", async () => {
  const provider = new FakeAiProvider();
  const service = new AiService(provider);

  const actions: (
    | "continue"
    | "rewrite"
    | "paraphrase"
    | "expand"
    | "simplify"
  )[] = ["continue", "rewrite", "paraphrase", "expand", "simplify"];

  for (const action of actions) {
    const blocks = await service.generateWritingProposal({
      action,
      text: "Original text",
    });

    assert.strictEqual(blocks.length, 1);
    const paragraph = blocks[0] as ParagraphElement;
    assert.strictEqual(
      paragraph.children[0]?.text,
      `Fake result for ${action}`,
    );
  }
});

test("AiService - generateWritingProposal with unsupported action", async () => {
  const provider = new FakeAiProvider();
  let providerCalled = false;
  const trackingProvider: AiProvider = {
    generateText: async (systemPrompt, userPrompt, action) => {
      providerCalled = true;
      return provider.generateText(systemPrompt, userPrompt, action);
    },
  };
  const service = new AiService(trackingProvider);

  await assert.rejects(
    () =>
      service.generateWritingProposal({
        action: "unknown" as unknown as "continue",
        text: "text",
      }),
    /Unsupported action for writing: unknown/,
  );

  assert.strictEqual(
    providerCalled,
    false,
    "Provider should not be called for unsupported action",
  );
});

test("FakeAiProvider coverage - outline and writing", async () => {
  const provider = new FakeAiProvider();

  const outlineResp = await provider.generateText(
    "system",
    "prompt",
    "outline",
  );
  assert.ok(outlineResp.includes("Fake Outline"));

  const rewriteResp = await provider.generateText(
    "system",
    "prompt",
    "rewrite",
  );
  assert.ok(rewriteResp.includes("Fake result for rewrite"));
});
