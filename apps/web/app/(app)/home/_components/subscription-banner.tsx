"use client";

import { Button } from "@/components/ui/button";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";

export function SubscriptionBanner() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4"
    >
      <div className="relative overflow-hidden rounded-2xl border-2 border-solid border-primary/40 bg-primary/5 p-5 text-foreground transition-colors hover:border-primary/60">
        <div className="relative z-10 flex flex-col items-center text-center gap-3">
          <div className="relative w-24 h-24 mb-2">
            <Image
              src="/assets/woman chooses a planet in virtual reality.svg"
              alt="Upgrade to Pro illustration"
              fill
              className="object-contain opacity-90 dark:opacity-100 dark:invert"
            />
          </div>

          <div>
            <h3 className="text-2xl font-handwritten text-foreground mb-1 flex items-center justify-center gap-2">
              <HugeiconsIcon icon={SparklesIcon} size={20} className="text-primary" />
              Upgrade to Pro
            </h3>
            <p className="text-sm font-handwritten text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
              Unlock unlimited uploads, advanced AI analysis, and priority support.
            </p>
          </div>

          <Button
            asChild
            className="mt-2 w-full rounded-full font-handwritten text-lg h-11 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            <Link href="/settings/billing">
              Upgrade Now
            </Link>
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
