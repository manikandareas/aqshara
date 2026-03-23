import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "1.5rem",
        background:
          "radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 30%), linear-gradient(180deg, #f8fafc 0%, #fff 100%)",
      }}
    >
      <div style={{ width: "min(1200px, 100%)", margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "1rem 1.25rem",
            borderRadius: "1.25rem",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            background: "rgba(255, 255, 255, 0.92)",
          }}
        >
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <Link href="/app" style={{ fontWeight: 700, color: "#0f172a" }}>
              Aqshara Workspace
            </Link>
            <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
              Sprint 1 path: auth, documents, editor, autosave.
            </p>
          </div>
          <UserButton />
        </header>
        {children}
      </div>
    </main>
  );
}
