import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (session.userId) {
    redirect("/app");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background:
          "radial-gradient(circle at top left, rgba(251, 191, 36, 0.18), transparent 35%), linear-gradient(135deg, #fff7ed 0%, #e0f2fe 100%)",
      }}
    >
      <section
        style={{
          width: "min(100%, 980px)",
          display: "grid",
          gap: "1.5rem",
          padding: "2rem",
          borderRadius: "1.75rem",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          background: "rgba(255, 255, 255, 0.92)",
          boxShadow: "0 30px 80px rgba(15, 23, 42, 0.12)",
        }}
      >
        <p style={{ letterSpacing: "0.16em", textTransform: "uppercase", color: "#b45309", fontSize: "0.85rem" }}>
          Writing-first MVP
        </p>
        <h1 style={{ fontSize: "clamp(2.25rem, 6vw, 4.5rem)", lineHeight: 1, color: "#0f172a" }}>
          Draft academic writing without losing structure.
        </h1>
        <p style={{ maxWidth: "46rem", color: "#475569", fontSize: "1.05rem", lineHeight: 1.8 }}>
          Aqshara gives you a lightweight workspace for documents, a structured block editor, and a save path that survives refreshes. Sprint 1 focuses on the core path: sign in, create a draft, write, and come back to it.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <SignInButton mode="modal">
            <button style={primaryButtonStyle} type="button">
              Continue with Clerk
            </button>
          </SignInButton>
          <Link href="/sign-up" style={secondaryButtonStyle}>
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  padding: "0.9rem 1.25rem",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "#fff",
  color: "#0f172a",
  border: "1px solid rgba(15, 23, 42, 0.12)",
};
