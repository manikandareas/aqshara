export type DocumentNode =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet_list"; items: string[] };

export type DocumentAst = {
  version: 1;
  nodes: DocumentNode[];
};

export function createEmptyDocument(): DocumentAst {
  return {
    version: 1,
    nodes: [],
  };
}

export function toPlainText(document: DocumentAst): string {
  return document.nodes
    .flatMap((node) => {
      if (node.type === "bullet_list") {
        return node.items;
      }

      return node.text;
    })
    .join("\n")
    .trim();
}
