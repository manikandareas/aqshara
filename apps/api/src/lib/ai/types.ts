export type AiActionType =
  | "outline"
  | "continue"
  | "rewrite"
  | "paraphrase"
  | "expand"
  | "simplify"
  | "section_draft";

export interface GenerateOutlineInput {
  action: "outline";
  topic: string;
  context?: string;
  documentType?: "general_paper" | "proposal" | "skripsi";
  templateCode?: "blank" | "general_paper" | "proposal" | "skripsi";
}

export interface GenerateWritingInput {
  action:
    | "continue"
    | "rewrite"
    | "paraphrase"
    | "expand"
    | "simplify"
    | "section_draft";
  text: string;
  context?: string;
  instructions?: string;
  sectionPrompt?: string;
}

export interface AiProvider {
  generateText(
    systemPrompt: string,
    userPrompt: string,
    action: string,
  ): Promise<string>;
}
