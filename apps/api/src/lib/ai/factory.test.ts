import test from "node:test";
import assert from "node:assert";
import { createAiServiceForEnv } from "./factory.js";
import type { Logger } from "../logger.js";

const silentLogger: Logger = {
  info() {},
  warn() {},
  error() {},
};

test("createAiServiceForEnv uses FakeAiProvider when OPENAI_API_KEY is unset", async () => {
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const service = createAiServiceForEnv(silentLogger);
    const draft = await service.generateOutlineDraft({
      action: "outline",
      topic: "x",
    });
    assert.strictEqual(draft.title, "Fake Outline");
  } finally {
    if (prev !== undefined) {
      process.env.OPENAI_API_KEY = prev;
    }
  }
});
