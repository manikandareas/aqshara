import type { DocumentValue } from "@aqshara/documents";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

function headingLevel(level: 1 | 2 | 3): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  if (level === 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

function blockText(block: DocumentValue[number]): string {
  if (block.type === "bullet-list") {
    return block.children
      .map((li) => li.children.map((t) => t.text).join(""))
      .join("\n");
  }
  return block.children.map((c) => c.text).join("");
}

export async function renderDocumentValueToDocxBuffer(input: {
  title: string;
  value: DocumentValue;
}): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];

  if (input.title.trim()) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: input.title.trim() })],
        heading: HeadingLevel.TITLE,
      }),
    );
  }

  for (const block of input.value) {
    if (block.type === "heading") {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: blockText(block) })],
          heading: headingLevel(block.level),
        }),
      );
    } else if (block.type === "paragraph") {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: blockText(block) })],
        }),
      );
    } else if (block.type === "bullet-list") {
      for (const li of block.children) {
        const text = li.children.map((t) => t.text).join("");
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text })],
            bullet: { level: 0 },
          }),
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
