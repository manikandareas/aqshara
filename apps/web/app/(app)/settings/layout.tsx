"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col md:flex-row gap-10 md:gap-8 px-6 py-8 md:py-12 min-h-[calc(100vh-60px)] pb-8">
      {/* Sidebar */}
      <div className="w-full md:w-[240px] shrink-0 flex flex-col gap-6 md:sticky md:top-[92px] md:self-start">
        <div>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E5E5E5] dark:border-border bg-white dark:bg-card text-[14px] font-medium text-foreground hover:bg-gray-50 dark:hover:bg-accent transition-colors shadow-sm mb-6"
          >
            Back
          </Link>
          <h1 className="text-[32px] font-bold text-foreground tracking-tight">
            Settings
          </h1>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/settings"
            className={`flex items-center w-full px-4 py-3 rounded-[10px] text-[15px] font-medium transition-colors text-left ${
              pathname === "/settings"
                ? "bg-[#2A2A2A] dark:bg-white text-white dark:text-black"
                : "text-[#4A4A4A] dark:text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            General
          </Link>
          <Link
            href="/settings/billing"
            className={`flex items-center w-full px-4 py-3 rounded-[10px] text-[15px] font-medium transition-colors text-left ${
              pathname === "/settings/billing"
                ? "bg-[#2A2A2A] dark:bg-white text-white dark:text-black"
                : "text-[#4A4A4A] dark:text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            Billing
          </Link>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">{children}</div>
    </div>
  );
}
