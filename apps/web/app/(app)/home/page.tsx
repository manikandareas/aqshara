"use client";

import { listDocuments, type DocumentItem } from "@aqshara/api";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import {
  PlusIcon,
  FileTextIcon,
  AlertCircleIcon,
  Loader2Icon,
  CheckCircle2Icon,
} from "lucide-react";
import Link from "next/link";
import { formatRelativeDate } from "@/lib/format";

export default function HomePage() {
  const { getToken, isLoaded } = useAuth();

  const documentsQuery = useQuery({
    queryKey: ["documents", "home"],
    enabled: isLoaded,
    queryFn: () => listDocuments({ page: 1, limit: 20 }, getToken),
  });

  const documents = documentsQuery.data?.data ?? [];

  if (!isLoaded) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-destructive";
      default:
        return "bg-primary";
    }
  };

  return (
    <div className="font-sans mx-auto w-full max-w-6xl px-6 py-8 md:py-12 min-h-screen">
      <h1 className="font-serif text-2xl md:text-[28px] font-medium tracking-tight mb-8 text-foreground">
        Documents
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Upload Document Card */}
        <Link
          href="/upload"
          className="flex flex-col items-center justify-center p-6 h-[230px] rounded-[14px] border border-dashed border-border/60 bg-transparent text-muted-foreground hover:bg-muted/10 transition-colors group"
        >
          <div className="flex items-center gap-2 group-hover:text-foreground transition-colors">
            <PlusIcon size={18} />
            <span className="font-medium text-[14px]">Upload document</span>
          </div>
        </Link>

        {/* Existing Documents Cards */}
        {documents.map((doc: DocumentItem) => (
          <Link
            href={`/library/${doc.id}`}
            key={doc.id}
            className="flex flex-col h-[230px] rounded-[14px] border border-border/40 bg-card overflow-hidden relative group hover:border-border/60 transition-colors shadow-sm"
          >
            {/* Top color highlight line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] w-full bg-border/20">
              <div
                className={`absolute top-0 left-[20%] right-[20%] h-[2px] ${getStatusColor(doc.status)}`}
              ></div>
            </div>

            <div className="p-6 flex flex-col h-full z-10">
              {/* Card Header: Icon + ID */}
              <div className="flex items-start justify-between gap-4 w-full">
                <div className="w-8 h-8 opacity-80 rounded-full border border-border/50 flex items-center justify-center shrink-0 bg-transparent text-muted-foreground">
                  <FileTextIcon className="w-4 h-4 text-muted-foreground/70" />
                </div>
                <div className="font-mono text-[11px] text-muted-foreground/60 truncate mt-1">
                  {doc.id.split("-")[0] + "..."}
                </div>
              </div>

              {/* Card Body: Title + Status */}
              <div className="mt-6 flex-1">
                <h3
                  className="text-[15px] font-semibold text-foreground/90 mb-3 truncate"
                  title={doc.filename}
                >
                  {doc.filename}
                </h3>

                {doc.status === "failed" ? (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] border border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground/70 text-[11px] font-medium leading-none">
                    <AlertCircleIcon className="w-3.5 h-3.5 text-destructive" />
                    <span className="capitalize">
                      {doc.pipeline_stage.replace("_", " ")} Error
                    </span>
                  </div>
                ) : doc.status === "completed" ? (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] border border-border/30 bg-transparent text-muted-foreground/70 text-[11px] font-medium leading-none">
                    <CheckCircle2Icon className="w-3.5 h-3.5 text-green-500" />
                    <span>Completed</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] border border-border/30 bg-transparent text-muted-foreground/70 text-[11px] font-medium leading-none">
                    <Loader2Icon className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span className="capitalize">
                      {doc.pipeline_stage.replace("_", " ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer: Updated At */}
              <div className="mt-auto pt-4 flex items-end">
                <p className="text-[11px] text-muted-foreground/50 font-medium tracking-wide">
                  {formatRelativeDate(doc.created_at)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
