"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { ClerkUserNav } from "@/components/clerk-user-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  const pathname = usePathname();

  const isActiveLink = (href: string) => {
    return (
      pathname === href || (href !== "/home" && pathname?.startsWith(href))
    );
  };

  return (
    <header className="relative max-w-6xl mx-auto flex items-center justify-between h-[60px] px-6 bg-background">
      <Link href="/home" className="flex items-center gap-2 group">
        <span className="font-bold text-xl tracking-tight text-foreground group-hover:opacity-80 transition-opacity hidden sm:inline-block">
          aqshara
        </span>
      </Link>

      <div className="flex items-center gap-6">
        <ThemeToggle />
        <ClerkUserNav />
      </div>
    </header>
  );
}
