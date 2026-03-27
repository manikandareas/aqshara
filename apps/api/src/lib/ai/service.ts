import { z } from "@hono/zod-openapi";
import type { OutlineDraft, DocumentBlock } from "@aqshara/documents";
import type {
  AiProvider,
  GenerateOutlineInput,
  GenerateWritingInput,
} from "./types.js";
import {
  buildOutlinePrompt,
  buildWritingPrompt,
  SYSTEM_PROMPTS,
} from "./prompts.js";

const OutlineDraftNodeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string(),
  }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("bullet_list"), items: z.array(z.string()) }),
]);

const OutlineDraftSchema = z.object({
  title: z.string().default("Untitled"),
  nodes: z.array(OutlineDraftNodeSchema).default([]),
});

const TTextSchema = z.object({ text: z.string() });

const DocumentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    id: z.string(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    children: z.array(TTextSchema),
  }),
  z.object({
    type: z.literal("paragraph"),
    id: z.string(),
    children: z.array(TTextSchema),
  }),
  z.object({
    type: z.literal("bullet-list"),
    id: z.string(),
    children: z.array(
      z.object({
        type: z.literal("list-item"),
        id: z.string(),
        children: z.array(TTextSchema),
      }),
    ),
  }),
]);

const DocumentBlockArraySchema = z.array(DocumentBlockSchema);

export class AiService {
  constructor(private readonly provider: AiProvider) {}

  async generateOutlineDraft(
    input: GenerateOutlineInput,
  ): Promise<OutlineDraft> {
    if (input.action !== "outline") {
      throw new Error(`Unsupported action for outline: ${input.action}`);
    }

    const userPrompt = buildOutlinePrompt(input);
    const responseText = await this.provider.generateText(
      SYSTEM_PROMPTS.outline,
      userPrompt,
      "outline",
    );

    try {
      const parsed = JSON.parse(responseText);
      return OutlineDraftSchema.parse(parsed);
    } catch {
      throw new Error("Failed to parse provider response into OutlineDraft");
    }
  }

  async generateWritingProposal(
    input: GenerateWritingInput,
  ): Promise<DocumentBlock[]> {
    const validActions = [
      "continue",
      "rewrite",
      "paraphrase",
      "expand",
      "simplify",
      "section_draft",
    ];
    if (!validActions.includes(input.action)) {
      throw new Error(`Unsupported action for writing: ${input.action}`);
    }

    const userPrompt = buildWritingPrompt(input);
    const responseText = await this.provider.generateText(
      SYSTEM_PROMPTS.writing,
      userPrompt,
      input.action,
    );

    try {
      const parsed = JSON.parse(responseText);
      return DocumentBlockArraySchema.parse(parsed);
    } catch {
      throw new Error(
        "Failed to parse provider response into DocumentBlock array",
      );
    }
  }
}
