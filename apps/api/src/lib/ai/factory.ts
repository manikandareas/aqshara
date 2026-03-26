import type { Logger } from "../logger.js";
import { AiService } from "./service.js";
import { FakeAiProvider } from "./provider.js";
import { OpenAiProvider } from "./openai-provider.js";

const DEFAULT_MODEL = "gpt-4o-mini";

export function createAiServiceForEnv(logger: Logger): AiService {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("OPENAI_API_KEY missing; AI endpoints use FakeAiProvider");
    return new AiService(new FakeAiProvider());
  }

  const baseURL = process.env.OPENAI_URL?.trim();
  const model =
    process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  return new AiService(
    new OpenAiProvider({
      apiKey,
      model,
      ...(baseURL ? { baseURL } : {}),
    }),
  );
}
