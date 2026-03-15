"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeDate, titleCase } from "@/lib/format";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import type { DocumentItem } from "@aqshara/api";

interface ActivityFeedProps {
  activities: { id: string; date: string; document: DocumentItem }[];
  isLoading: boolean;
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <h2 className="text-2xl font-handwritten text-foreground mb-6">
        Activity
      </h2>

      <div className="flex flex-col gap-6 relative">
        {/* Subtle timeline line */}
        {!isLoading && activities.length > 0 && (
          <div className="absolute left-4 top-4 bottom-4 w-px border-l border-dashed border-border/40 hidden sm:block" />
        )}

        {isLoading ? (
          <div className="flex flex-col gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : activities.length > 0 ? (
          activities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative flex gap-4 sm:gap-6"
            >
              {/* Timeline dot */}
              <div className="hidden sm:flex w-8 justify-center mt-6 z-10 shrink-0">
                <div className="h-2 w-2 shrink-0 rounded-full bg-foreground/20 ring-4 ring-background" />
              </div>

              {/* Activity Content */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <span className="text-sm font-handwritten text-muted-foreground">
                  {formatRelativeDate(activity.date)}
                </span>

                <div className="rounded-2xl border border-dashed border-border/40 bg-transparent p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center hover:bg-accent/5 transition-colors group">
                  <div className="relative flex aspect-2/3 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded border border-dashed border-border/50 bg-background p-1.5 text-center">
                    <div className="absolute left-0 top-0 h-full w-[2px] bg-foreground/10" />
                    <span className="line-clamp-4 text-[8px] font-bold leading-tight text-foreground/70 font-sans">
                      {activity.document.filename.replace(/\.[^/.]+$/, "")}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col min-w-0">
                    <h3 className="text-lg font-serif text-foreground truncate group-hover:text-primary transition-colors">
                      {activity.document.filename.replace(/\.[^/.]+$/, "")}
                    </h3>
                    <p className="text-sm font-handwritten text-muted-foreground mt-1">
                      {titleCase(activity.document.pipeline_stage)}
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <Button
                        asChild
                        variant="outline"
                        className="rounded-full h-8 px-4 font-handwritten text-base border-dashed hover:bg-foreground hover:text-background"
                      >
                        <Link href={`/library/${activity.document.id}`}>
                          View Document
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/40 bg-transparent p-8 text-center flex flex-col items-center">
            <div className="relative w-40 h-40 mb-6">
              <Image
                src="/assets/woman communicates with a viral assistant.svg"
                alt="No activity"
                fill
                className="object-contain opacity-80 dark:opacity-100 dark:invert"
              />
            </div>
            <h3 className="text-2xl font-handwritten text-foreground">
              No activity yet
            </h3>
            <p className="mt-2 text-lg font-handwritten text-muted-foreground max-w-md mx-auto">
              Upload a document to see your activity feed populate.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
