import OpenAI from "openai";
import type { AiProvider } from "./types.js";

const DEFAULT_MODEL = "gpt-4o-mini";

const JSON_ONLY_SUFFIX =
  "\n\nReply with only valid JSON: no markdown code fences, no preamble or explanation.";

export type OpenAiProviderConfig = {
  apiKey: string;
  model?: string;
  baseURL?: string;
};

export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: OpenAiProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    action: string,
  ): Promise<string> {
    void action;
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${userPrompt}${JSON_ONLY_SUFFIX}` },
        ],
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0]?.message?.content;
      if (content == null || content.trim() === "") {
        throw new Error("OpenAI returned empty content");
      }
      return content;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OpenAI request failed";
      throw new Error(`OpenAI provider error: ${message}`);
    }
  }
}
