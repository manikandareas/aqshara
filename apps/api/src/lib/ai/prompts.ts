import type { GenerateOutlineInput, GenerateWritingInput } from "./types.js";

export function buildOutlinePrompt(
  input: Omit<GenerateOutlineInput, "action">,
): string {
  let prompt = `Create a structured outline for the following topic: ${input.topic}`;
  if (input.context) {
    prompt += `\n\nContext:\n${input.context}`;
  }
  prompt += `\n\nFormat the output as a valid JSON object matching the OutlineDraft schema.`;
  return prompt;
}

export function buildWritingPrompt(input: GenerateWritingInput): string {
  let instruction = "";
  switch (input.action) {
    case "continue":
      instruction = "Continue the following text naturally and logically.";
      break;
    case "rewrite":
      instruction = `Rewrite the following text based on these instructions: ${input.instructions ?? "Improve clarity and flow."}`;
      break;
    case "paraphrase":
      instruction =
        "Paraphrase the following text while keeping the original meaning intact.";
      break;
    case "expand":
      instruction =
        "Expand the following text by adding relevant details and elaborating on the main points.";
      break;
    case "simplify":
      instruction =
        "Simplify the following text to make it easier to understand.";
      break;
    default: {
      const _exhaustiveCheck: never = input.action;
      throw new Error(
        `Unsupported writing action: ${String(_exhaustiveCheck)}`,
      );
    }
  }

  let prompt = `${instruction}\n\nText:\n${input.text}`;

  if (input.context) {
    prompt += `\n\nAdditional Context:\n${input.context}`;
  }

  prompt += `\n\nFormat the output as a valid JSON array of DocumentBlock objects.`;
  return prompt;
}

export const SYSTEM_PROMPTS = {
  outline:
    "You are an expert academic and professional writer. You generate clear, well-structured outlines.",
  writing:
    "You are an expert academic and professional writer. You produce high-quality, precise text formatted as DocumentBlock JSON arrays.",
};
