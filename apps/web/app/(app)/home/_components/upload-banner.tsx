"use client";

import { Button } from "@/components/ui/button";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";

export function UploadBanner() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-transparent p-5 text-foreground transition-colors hover:border-foreground/30 hover:bg-accent/5">
        <div className="relative z-10 flex flex-col items-center text-center gap-3">
          <div className="relative w-24 h-24 mb-2">
            <Image
              src="/assets/woman uploads files to the cloud.svg"
              alt="Upload illustration"
              fill
              className="object-contain opacity-90 dark:opacity-100 dark:invert"
            />
          </div>

          <div>
            <h3 className="text-2xl font-handwritten text-foreground mb-1">
              Analyze a new paper
            </h3>
            <p className="text-sm font-handwritten text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
              Upload a document to unlock AI-powered translations, glossaries, and deep insights.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="mt-2 w-full rounded-full border-dashed font-handwritten text-lg h-11 hover:bg-foreground hover:text-background transition-all"
          >
            <Link
              href="/upload"
              className="flex items-center justify-center gap-2"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={18} />
              Upload Document
            </Link>
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
