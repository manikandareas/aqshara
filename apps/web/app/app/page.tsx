import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createDocumentAction } from "./actions";
import { ApiRequestError, fetchDocuments, fetchSession } from "../../lib/api";

async function requireAccessToken() {
  const session = await auth();
  const token = await session.getToken();

  if (!session.userId || !token) {
    redirect("/sign-in");
  }

  return token;
}

export default async function AppDashboardPage() {
  const token = await requireAccessToken();

  try {
    const [session, activeDocuments, archivedDocuments] = await Promise.all([
      fetchSession(token),
      fetchDocuments(token, "active"),
      fetchDocuments(token, "archived"),
    ]);

    return (
      <div style={{ display: "grid", gap: "1.5rem" }}>
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
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <p style={{ color: "#b45309", textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.8rem" }}>
              Current plan
            </p>
            <h1 style={{ fontSize: "2rem", color: "#0f172a" }}>
              {session.workspace.name}
            </h1>
            <p style={{ color: "#475569", maxWidth: "42rem", lineHeight: 1.7 }}>
              Signed in as {session.user.email}. Free plan remaining quota: {session.usage.aiActionsRemaining} AI actions, {session.usage.exportsRemaining} DOCX exports.
            </p>
          </div>

          <form action={createDocumentAction} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input
              name="title"
              placeholder="Judul draft"
              style={inputStyle}
            />
            <select name="type" style={inputStyle}>
              <option value="general_paper">General paper</option>
              <option value="proposal">Proposal</option>
              <option value="skripsi">Skripsi</option>
            </select>
            <button style={primaryButtonStyle} type="submit">
              Create document
            </button>
          </form>
        </section>

        <section style={sectionStyle}>
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <h2 style={{ fontSize: "1.35rem", color: "#0f172a" }}>Active documents</h2>
            <p style={{ color: "#64748b" }}>
              Open the latest draft and continue writing immediately.
            </p>
          </div>

          {activeDocuments.documents.length === 0 ? (
            <div style={emptyStateStyle}>
              <h3 style={{ color: "#0f172a" }}>No drafts yet</h3>
              <p style={{ color: "#64748b", lineHeight: 1.7 }}>
                Create your first document above to enter the editor with a starter structure.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {activeDocuments.documents.map((document) => (
                <Link href={`/app/documents/${document.id}`} key={document.id} style={documentCardStyle}>
                  <div>
                    <h3 style={{ color: "#0f172a" }}>{document.title}</h3>
                    <p style={{ color: "#64748b", marginTop: "0.25rem" }}>{document.type}</p>
                  </div>
                  <span style={{ color: "#475569", fontSize: "0.9rem" }}>
                    Updated {new Date(document.updatedAt).toLocaleString("id-ID")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {archivedDocuments.documents.length > 0 ? (
          <section style={sectionStyle}>
            <h2 style={{ fontSize: "1.2rem", color: "#0f172a" }}>Archived</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {archivedDocuments.documents.map((document) => (
                <article key={document.id} style={documentCardStyle}>
                  <div>
                    <h3 style={{ color: "#0f172a" }}>{document.title}</h3>
                    <p style={{ color: "#64748b", marginTop: "0.25rem" }}>{document.type}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === "account_provisioning") {
      return (
        <section style={sectionStyle}>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <p style={{ color: "#b45309", textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.8rem" }}>
              Provisioning
            </p>
            <h1 style={{ fontSize: "2rem", color: "#0f172a" }}>
              Account setup is still in progress
            </h1>
            <p style={{ color: "#475569", maxWidth: "40rem", lineHeight: 1.7 }}>
              Clerk authentication succeeded, but your workspace has not been provisioned in Aqshara yet. Refresh this page in a moment after the webhook is delivered.
            </p>
          </div>
        </section>
      );
    }

    if (error instanceof ApiRequestError && error.code === "account_deleted") {
      return (
        <section style={sectionStyle}>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <p style={{ color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.8rem" }}>
              Access removed
            </p>
            <h1 style={{ fontSize: "2rem", color: "#0f172a" }}>
              This Aqshara account is no longer active
            </h1>
            <p style={{ color: "#475569", maxWidth: "40rem", lineHeight: 1.7 }}>
              Your Clerk account is signed in, but access to the local Aqshara workspace has been disabled.
            </p>
          </div>
        </section>
      );
    }

    throw error;
  }
}

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "1.5rem",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  background: "rgba(255, 255, 255, 0.96)",
};

const documentCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "1rem 1.1rem",
  borderRadius: "1rem",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "#f8fafc",
};

const emptyStateStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  padding: "1.25rem",
  borderRadius: "1rem",
  border: "1px dashed rgba(148, 163, 184, 0.45)",
  background: "#f8fafc",
};

const inputStyle: React.CSSProperties = {
  minWidth: "220px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  padding: "0.85rem 1rem",
  font: "inherit",
  background: "#fff",
};

const primaryButtonStyle: React.CSSProperties = {
  borderRadius: "999px",
  border: "none",
  padding: "0.85rem 1.1rem",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};
