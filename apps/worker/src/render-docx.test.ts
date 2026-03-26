import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DocumentValue } from "@aqshara/documents";
import { renderDocumentValueToDocxBuffer } from "./render-docx.js";

describe("render-docx", () => {
  it("produces a non-empty DOCX buffer for a simple document", async () => {
    const value: DocumentValue = [
      {
        type: "heading",
        id: "h1",
        level: 1,
        children: [{ text: "Title" }],
      },
      {
        type: "paragraph",
        id: "p1",
        children: [{ text: "Body" }],
      },
    ];

    const buf = await renderDocumentValueToDocxBuffer({
      title: "Doc title",
      value,
    });

    assert.ok(buf.length > 100);
    assert.equal(buf.subarray(0, 2).toString("binary"), "PK");
  });
});
