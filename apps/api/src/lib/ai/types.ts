export type AiActionType =
  | "outline"
  | "continue"
  | "rewrite"
  | "paraphrase"
  | "expand"
  | "simplify";

export interface GenerateOutlineInput {
  action: "outline";
  topic: string;
  context?: string;
}

export interface GenerateWritingInput {
  action: "continue" | "rewrite" | "paraphrase" | "expand" | "simplify";
  text: string;
  context?: string;
  instructions?: string;
}

export interface AiProvider {
  generateText(
    systemPrompt: string,
    userPrompt: string,
    action: string,
  ): Promise<string>;
}
