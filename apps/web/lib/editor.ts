import { createEmptyDocument, type DocumentAst } from "@aqshara/documents";

export function createStarterDocument(title: string): DocumentAst {
  return {
    ...createEmptyDocument(),
    nodes: [
      {
        type: "heading",
        level: 1,
        text: title,
      },
      {
        type: "paragraph",
        text: "Mulai tulis latar belakang, tujuan, atau ide utama dokumen ini.",
      },
    ],
  };
}

export function buildOutline(document: DocumentAst) {
  return document.nodes.flatMap((node, index) =>
    node.type === "heading"
      ? [
          {
            index,
            label: node.text || "Untitled heading",
            level: node.level,
          },
        ]
      : [],
  );
}
