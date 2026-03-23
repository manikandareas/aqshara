"use client";

import type { DocumentAst } from "@aqshara/documents";
import { useAuth } from "@clerk/nextjs";
import { startTransition, useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiDocument } from "../lib/api";
import { archiveDocument, deleteDocument, saveDocumentContent, updateDocumentMetadata } from "../lib/api";
import { buildOutline } from "../lib/editor";

type SaveState = "idle" | "saving" | "saved" | "error";

const editorGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "1.5rem",
  gridTemplateColumns: "minmax(0, 1fr) 260px",
  alignItems: "start",
};

function createNode(type: "paragraph" | "heading" | "bullet_list"): DocumentAst["nodes"][number] {
  if (type === "heading") {
    return { type: "heading", level: 2, text: "Subjudul baru" };
  }

  if (type === "bullet_list") {
    return { type: "bullet_list", items: ["Poin pertama"] };
  }

  return { type: "paragraph", text: "" };
}

export function DocumentEditor({ initialDocument }: { initialDocument: ApiDocument }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState(initialDocument.title);
  const [documentValue, setDocumentValue] = useState(initialDocument.contentJson);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hasMounted = useRef(false);
  const deferredDocument = useDeferredValue(documentValue);
  const outline = buildOutline(deferredDocument);

  const persistChanges = useEffectEvent(async (nextTitle: string, nextDocument: DocumentAst) => {
    const token = await getToken();

    if (!token) {
      setSaveState("error");
      return;
    }

    try {
      await updateDocumentMetadata(token, initialDocument.id, {
        title: nextTitle,
      });
      await saveDocumentContent(token, initialDocument.id, nextDocument);
      setSaveState("saved");
      router.refresh();
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  });

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      void persistChanges(title, documentValue);
    }, 700);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [documentValue, persistChanges, title]);

  async function handleArchive() {
    const token = await getToken();

    if (!token) {
      return;
    }

    await archiveDocument(token, initialDocument.id);
    startTransition(() => {
      router.push("/app");
      router.refresh();
    });
  }

  async function handleDelete() {
    const token = await getToken();

    if (!token) {
      return;
    }

    await deleteDocument(token, initialDocument.id);
    startTransition(() => {
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem",
          borderRadius: "1.25rem",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          background: "rgba(255, 255, 255, 0.9)",
        }}
      >
        <div style={{ display: "grid", gap: "0.5rem", flex: 1 }}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          />
          <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
            Save state: {saveState}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={handleArchive} style={secondaryButtonStyle} type="button">
            Archive
          </button>
          <button onClick={handleDelete} style={dangerButtonStyle} type="button">
            Delete
          </button>
        </div>
      </header>

      <div style={editorGridStyle}>
        <section
          style={{
            display: "grid",
            gap: "1rem",
            padding: "1.5rem",
            borderRadius: "1.5rem",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            background: "rgba(255, 255, 255, 0.96)",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={() =>
                setDocumentValue((current) => ({
                  ...current,
                  nodes: [...current.nodes, createNode("paragraph")],
                }))
              }
              style={secondaryButtonStyle}
              type="button"
            >
              Add paragraph
            </button>
            <button
              onClick={() =>
                setDocumentValue((current) => ({
                  ...current,
                  nodes: [...current.nodes, createNode("heading")],
                }))
              }
              style={secondaryButtonStyle}
              type="button"
            >
              Add heading
            </button>
            <button
              onClick={() =>
                setDocumentValue((current) => ({
                  ...current,
                  nodes: [...current.nodes, createNode("bullet_list")],
                }))
              }
              style={secondaryButtonStyle}
              type="button"
            >
              Add list
            </button>
          </div>

          {documentValue.nodes.map((node, index) => (
            <article
              id={`node-${index}`}
              key={`${node.type}-${index}`}
              style={{
                display: "grid",
                gap: "0.75rem",
                padding: "1rem",
                borderRadius: "1rem",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "#475569", textTransform: "uppercase" }}>
                  {node.type.replace("_", " ")}
                </span>
                <button
                  onClick={() =>
                    setDocumentValue((current) => ({
                      ...current,
                      nodes: current.nodes.filter((_, nodeIndex) => nodeIndex !== index),
                    }))
                  }
                  style={ghostButtonStyle}
                  type="button"
                >
                  Remove
                </button>
              </div>

              {node.type === "heading" ? (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <select
                    value={node.level}
                    onChange={(event) =>
                      setDocumentValue((current) => ({
                        ...current,
                        nodes: current.nodes.map((currentNode, nodeIndex) =>
                          nodeIndex === index && currentNode.type === "heading"
                            ? {
                                ...currentNode,
                                level: Number(event.target.value) as 1 | 2 | 3,
                              }
                            : currentNode,
                        ),
                      }))
                    }
                    style={selectStyle}
                  >
                    <option value={1}>Heading 1</option>
                    <option value={2}>Heading 2</option>
                    <option value={3}>Heading 3</option>
                  </select>
                  <textarea
                    value={node.text}
                    onChange={(event) =>
                      setDocumentValue((current) => ({
                        ...current,
                        nodes: current.nodes.map((currentNode, nodeIndex) =>
                          nodeIndex === index && currentNode.type === "heading"
                            ? {
                                ...currentNode,
                                text: event.target.value,
                              }
                            : currentNode,
                        ),
                      }))
                    }
                    rows={2}
                    style={textareaStyle}
                  />
                </div>
              ) : null}

              {node.type === "paragraph" ? (
                <textarea
                  value={node.text}
                  onChange={(event) =>
                    setDocumentValue((current) => ({
                      ...current,
                      nodes: current.nodes.map((currentNode, nodeIndex) =>
                        nodeIndex === index && currentNode.type === "paragraph"
                          ? {
                              ...currentNode,
                              text: event.target.value,
                            }
                          : currentNode,
                      ),
                    }))
                  }
                  rows={5}
                  style={textareaStyle}
                />
              ) : null}

              {node.type === "bullet_list" ? (
                <textarea
                  value={node.items.join("\n")}
                  onChange={(event) =>
                    setDocumentValue((current) => ({
                      ...current,
                      nodes: current.nodes.map((currentNode, nodeIndex) =>
                        nodeIndex === index && currentNode.type === "bullet_list"
                          ? {
                              ...currentNode,
                              items: event.target.value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            }
                          : currentNode,
                      ),
                    }))
                  }
                  rows={5}
                  style={textareaStyle}
                />
              ) : null}
            </article>
          ))}
        </section>

        <aside
          style={{
            display: "grid",
            gap: "0.75rem",
            padding: "1.25rem",
            borderRadius: "1.25rem",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            background: "rgba(255, 255, 255, 0.9)",
            position: "sticky",
            top: "1rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", color: "#0f172a" }}>Outline</h2>
          {outline.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
              Tambahkan heading untuk melihat outline dokumen.
            </p>
          ) : (
            outline.map((item) => (
              <button
                key={`${item.index}-${item.label}`}
                onClick={() => globalThis.document.getElementById(`node-${item.index}`)?.scrollIntoView({ behavior: "smooth" })}
                style={{
                  ...ghostButtonStyle,
                  justifyContent: "flex-start",
                  paddingLeft: `${item.level * 0.75}rem`,
                }}
                type="button"
              >
                {item.label}
              </button>
            ))
          )}
        </aside>
      </div>
    </div>
  );
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "120px",
  border: "1px solid rgba(148, 163, 184, 0.4)",
  borderRadius: "0.9rem",
  padding: "0.9rem 1rem",
  font: "inherit",
  resize: "vertical",
  background: "#fff",
};

const selectStyle: React.CSSProperties = {
  ...textareaStyle,
  minHeight: "auto",
  padding: "0.7rem 0.9rem",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.35)",
  borderRadius: "999px",
  padding: "0.75rem 1rem",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 600,
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "999px",
  padding: "0.35rem 0.6rem",
  background: "transparent",
  color: "#334155",
  cursor: "pointer",
  display: "inline-flex",
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  background: "#fee2e2",
  borderColor: "#fecaca",
  color: "#991b1b",
};
