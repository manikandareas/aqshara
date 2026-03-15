"use client";

import React from "react";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { LogOut, Trash2 } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { user } = useUser();
  const [isSaving, setIsSaving] = React.useState(false);
  const [phone, setPhone] = React.useState("");

  React.useEffect(() => {
    if (user?.unsafeMetadata?.billing_phone) {
      setPhone(user.unsafeMetadata.billing_phone as string);
    }
  }, [user?.unsafeMetadata?.billing_phone]);

  const handleSaveBilling = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          billing_phone: phone,
        },
      });
    } catch (error) {
      console.error("Failed to update billing details:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    "";
  const displayName = user?.fullName ?? user?.firstName ?? "Reader";

  return (
    <>
      {/* Profile Section */}
      <section className="bg-white dark:bg-card border border-[#EBEBEB] dark:border-border rounded-[16px] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-[#EBEBEB] dark:border-border/50">
          <h2 className="text-[17px] font-bold text-foreground">Profile</h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-[84px] h-[84px] rounded-full overflow-hidden shrink-0 border border-[#EBEBEB] dark:border-border/50 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user?.imageUrl ?? "/assets/man-reading-book.svg"}
              alt="Profile Avatar"
              className="w-full h-full object-cover bg-[#EAF3FA]"
            />
          </div>
          <div className="flex-1 flex flex-col gap-3 w-full">
            <div className="flex items-center gap-3">
              <input
                type="text"
                defaultValue={displayName}
                className="flex-1 h-10 px-3.5 rounded-[8px] border border-[#EBEBEB] dark:border-border bg-white dark:bg-background text-[14px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-all"
              />
              <button
                disabled
                className="h-10 px-5 rounded-[8px] bg-[#D4D4D4] dark:bg-muted text-black/50 dark:text-muted-foreground text-[14px] font-medium transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-[14px] text-[#5A5A5A] dark:text-muted-foreground px-1">
              {primaryEmail}
            </p>
          </div>
        </div>
      </section>

      {/* Theme Section */}
      <section className="bg-white dark:bg-card border border-[#EBEBEB] dark:border-border rounded-[16px] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-[#EBEBEB] dark:border-border/50">
          <h2 className="text-[17px] font-bold text-foreground">Theme</h2>
        </div>
        <div className="p-6">
          <div className="relative">
            <select className="w-full h-11 px-4 appearance-none rounded-[8px] border border-[#EBEBEB] dark:border-border bg-white dark:bg-background text-[15px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-all cursor-pointer">
              <option value="light">🌞 Light</option>
              <option value="dark">🌙 Dark</option>
              <option value="system">💻 System</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 1L5 5L9 1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Billing Details Section */}
      <section className="bg-white dark:bg-card border border-[#EBEBEB] dark:border-border rounded-[16px] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-[#EBEBEB] dark:border-border/50">
          <h2 className="text-[17px] font-bold text-foreground">
            Billing Details
          </h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            These details will be used for your subscription invoices.
          </p>
        </div>
        <div className="grid gap-4 p-6">
          <label className="grid gap-2 text-[14px] font-medium text-foreground">
            Full name
            <input
              type="text"
              defaultValue={displayName}
              className="h-11 rounded-xl border border-[#D9D9D9] bg-white px-4 text-[14px] text-foreground outline-none transition-colors focus:border-[#2A2A2A] dark:border-border dark:bg-background"
              placeholder="Your billing name"
            />
          </label>
          <label className="grid gap-2 text-[14px] font-medium text-foreground">
            Email
            <input
              type="email"
              defaultValue={primaryEmail}
              className="h-11 rounded-xl border border-[#D9D9D9] bg-white px-4 text-[14px] text-foreground outline-none transition-colors focus:border-[#2A2A2A] dark:border-border dark:bg-background"
              placeholder="name@example.com"
            />
          </label>
          <label className="grid gap-2 text-[14px] font-medium text-foreground">
            Phone number
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 rounded-xl border border-[#D9D9D9] bg-white px-4 text-[14px] text-foreground outline-none transition-colors focus:border-[#2A2A2A] dark:border-border dark:bg-background"
              placeholder="+628123456789"
            />
          </label>
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveBilling}
              disabled={
                isSaving ||
                phone ===
                  ((user?.unsafeMetadata?.billing_phone as string) || "")
              }
              className="h-10 px-5 rounded-[8px] bg-[#2A2A2A] text-white disabled:bg-[#D4D4D4] dark:disabled:bg-muted disabled:text-black/50 dark:disabled:text-muted-foreground text-[14px] font-medium transition-colors"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-6 mt-4 md:mr-4">
        <SignOutButton>
          <button className="flex items-center gap-2.5 text-[14px] font-semibold text-[#3A3A3A] dark:text-muted-foreground hover:text-foreground transition-colors group">
            <LogOut className="w-[18px] h-[18px] text-[#3A3A3A] dark:text-muted-foreground group-hover:text-foreground transition-colors" />
            Logout
          </button>
        </SignOutButton>
        <button className="flex items-center gap-2.5 text-[14px] font-semibold text-[#3A3A3A] dark:text-muted-foreground hover:text-destructive transition-colors group">
          <Trash2 className="w-[18px] h-[18px] text-[#3A3A3A] dark:text-muted-foreground group-hover:text-destructive transition-colors" />
          Delete
        </button>
      </div>
    </>
  );
}
