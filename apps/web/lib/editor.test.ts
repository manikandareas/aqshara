import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOutline, createStarterDocument } from "./editor.ts";

describe("editor helpers", () => {
  it("creates a starter document with a heading and intro paragraph", () => {
    const document = createStarterDocument("Draft Skripsi");

    assert.equal(document.version, 1);
    assert.equal(document.nodes[0]?.type, "heading");
    assert.equal(document.nodes[0]?.text, "Draft Skripsi");
    assert.equal(document.nodes[1]?.type, "paragraph");
  });

  it("builds an outline only from heading nodes", () => {
    const outline = buildOutline({
      version: 1,
      nodes: [
        { type: "heading", level: 1, text: "Pendahuluan" },
        { type: "paragraph", text: "Latar belakang." },
        { type: "heading", level: 2, text: "Rumusan Masalah" },
      ],
    });

    assert.deepEqual(outline, [
      { index: 0, label: "Pendahuluan", level: 1 },
      { index: 2, label: "Rumusan Masalah", level: 2 },
    ]);
  });
});
