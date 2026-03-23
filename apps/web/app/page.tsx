import { createEmptyDocument, toPlainText } from "@aqshara/documents";

const bootstrapDocument = {
  ...createEmptyDocument(),
  nodes: [
    { type: "heading" as const, level: 1 as const, text: "Draft baru" },
    {
      type: "paragraph" as const,
      text: "Fondasi monorepo Aqshara sudah siap untuk auth, document workspace, AI assist, dan export.",
    },
  ],
};

const rails = [
  "Next.js product app di apps/web",
  "Hono REST API + OpenAPI + Swagger di apps/api",
  "BullMQ worker scaffold di apps/worker",
  "Generated TanStack Query API client di packages/api-client",
];

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", padding: "2rem", background: "linear-gradient(135deg, #fff7ed 0%, #eff6ff 100%)" }}>
      <section
        style={{
          display: "grid",
          gap: "1.5rem",
          padding: "2rem",
          borderRadius: "1.5rem",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          background:
            "linear-gradient(180deg, rgba(250, 250, 249, 0.96) 0%, rgba(255, 255, 255, 1) 100%)",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <p
            style={{
              fontSize: "0.8rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#9a3412",
            }}
          >
            Operational Foundation
          </p>
          <h1
            style={{
              fontSize: "clamp(2rem, 3vw, 3.5rem)",
              lineHeight: 1,
              color: "#111827",
            }}
          >
            Aqshara monorepo siap dipakai sebagai writing-first platform
          </h1>
          <p
            style={{
              maxWidth: "42rem",
              color: "#4b5563",
              fontSize: "1rem",
              lineHeight: 1.7,
            }}
          >
            Struktur app dan package sekarang mengikuti jalur MVP: auth, document
            workspace, structured editor, AI writing, quota, dan DOCX export.
          </p>
        </div>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {rails.map((rail) => (
              <article
                key={rail}
                style={{
                  padding: "1rem",
                  borderRadius: "1rem",
                  background: "rgba(255,255,255,0.8)",
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                }}
              >
                {rail}
              </article>
            ))}
          </div>
          <pre
            style={{
              padding: "1rem",
              borderRadius: "1rem",
              background: "#111827",
              color: "#f9fafb",
              overflowX: "auto",
            }}
          >
            {toPlainText(bootstrapDocument)}
          </pre>
        </div>
      </section>
    </main>
  );
}
