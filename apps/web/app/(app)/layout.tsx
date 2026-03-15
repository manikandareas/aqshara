"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const showNavbar = !(pathname?.startsWith("/library/") && pathname !== "/library");

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent selection:text-accent-foreground pb-24">
      {/* Top Navbar */}
      {showNavbar && <Navbar />}

      {/* Main Content */}
      {children}
    </div>
  );
}
