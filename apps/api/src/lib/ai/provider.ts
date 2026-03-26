import type { AiProvider } from "./types.js";

export class FakeAiProvider implements AiProvider {
  async generateText(systemPrompt: string, userPrompt: string, action: string): Promise<string> {
    if (action === "outline") {
      return JSON.stringify({
        title: "Fake Outline",
        nodes: [
          { type: "heading", level: 1, text: "Fake Heading" },
          { type: "paragraph", text: "Fake paragraph" }
        ]
      });
    }
    
    return JSON.stringify([
      { type: "paragraph", id: "fake-id", children: [{ text: `Fake result for ${action}` }] }
    ]);
  }
}
