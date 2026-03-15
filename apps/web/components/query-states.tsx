"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ArrowReloadHorizontalIcon,
  BubbleChatSparkIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

type ErrorStateProps = {
  title?: string;
  description: string;
  actionLabel?: string;
  onRetry?: () => void;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-300",
        className,
      )}
    >
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-secondary/50 ring-8 ring-secondary/20">
        <HugeiconsIcon icon={BubbleChatSparkIcon} size={28} className="text-muted-foreground" />
      </div>
      <h2 className="text-xl font-serif font-medium text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  actionLabel = "Try again",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-300",
        className
      )}
    >
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10 ring-8 ring-destructive/5">
        <HugeiconsIcon icon={AlertCircleIcon} size={28} className="text-destructive" />
      </div>
      <h2 className="text-xl font-serif font-medium text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
        {description}
      </p>
      {onRetry ? (
        <div className="mt-8">
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} />
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClassName =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-secondary text-secondary-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize",
        toneClassName,
      )}
    >
      {label}
    </span>
  );
}
