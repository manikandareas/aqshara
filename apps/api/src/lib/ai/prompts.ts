import type { GenerateOutlineInput, GenerateWritingInput } from "./types.js";

export function buildOutlinePrompt(
  input: Omit<GenerateOutlineInput, "action">,
): string {
  let prompt = `Create a structured outline for the following topic: ${input.topic}`;

  if (input.documentType) {
    prompt += `\n\nDocument type: ${input.documentType}`;
  }

  if (input.templateCode) {
    prompt += `\n\nTemplate code: ${input.templateCode}`;
  }

  if (input.context) {
    prompt += `\n\nContext:\n${input.context}`;
  }
  prompt +=
    "\n\nUse formal academic Indonesian. Match the document structure to the document type and template context when provided.";
  prompt += `\n\nOutput only a valid JSON object matching the OutlineDraft schema. Do not wrap the JSON in markdown code fences or add any text before or after it.`;
  return prompt;
}

export function buildWritingPrompt(input: GenerateWritingInput): string {
  let instruction = "";
  switch (input.action) {
    case "continue":
      instruction =
        "Continue the following text in formal academic Indonesian with the same tone and topic. Produce 1-3 paragraphs (approximately 100-300 words).";
      break;
    case "rewrite":
      instruction = `Rewrite the following text in formal academic Indonesian based on these instructions: ${input.instructions ?? "Improve clarity, precision, and flow."} Produce output of similar length to the original (within +/- 20%).`;
      break;
    case "paraphrase":
      instruction =
        "Paraphrase the following text while keeping the original meaning intact and preserving formal academic Indonesian. Produce output of similar length to the original (within +/- 20%).";
      break;
    case "expand":
      instruction =
        "Expand the following text by adding relevant academic details and elaborating on the main points in formal Indonesian. Produce approximately 1.5-2x the original length, aiming for 200-600 words.";
      break;
    case "simplify":
      instruction =
        "Simplify the following text while keeping it formal, accurate, and academically appropriate. Produce output of similar length or slightly shorter.";
      break;
    case "section_draft":
      instruction =
        `Draft a new section in formal academic Indonesian for the following prompt: ${input.sectionPrompt ?? "Write a relevant section draft."} Produce 2-5 paragraphs (approximately 200-600 words).`;
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

  prompt +=
    "\n\nUse formal academic Indonesian. Return only blocks that fit the requested action, with no markdown fences or commentary.";
  prompt += `\n\nOutput only a valid JSON array of DocumentBlock objects. Do not wrap the JSON in markdown code fences or add any text before or after it.`;
  return prompt;
}

export const SYSTEM_PROMPTS = {
  outline:
    "You are an expert academic and professional writer for Indonesian students. You generate clear, well-structured outlines in formal academic Indonesian. Each paragraph should contain 3-8 sentences. You respond with JSON only—no markdown fences, no commentary.",
  writing:
    "You are an expert academic and professional writer for Indonesian students. You produce high-quality, precise text as DocumentBlock JSON arrays in formal academic Indonesian. Each paragraph should contain 3-8 sentences. You respond with JSON only—no markdown fences, no commentary.",
};
