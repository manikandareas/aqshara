"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowLeft04Icon,
  CheckmarkCircle01Icon,
  File01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  getDocumentStatus,
  getErrorMessage,
  uploadDocument,
} from "@aqshara/api";
import Link from "next/link";
import { isDocumentTerminal } from "@/lib/status";
import {
  createAuthorizedEventSource,
  DocumentStatusStreamEvent,
  parseSsePayload,
} from "@aqshara/api";
import { titleCase } from "@/lib/format";
import { motion } from "motion/react";

const ACCEPTED_FILE_TYPES = ["application/pdf"];

export default function UploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getToken, isLoaded } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [requireTranslate, setRequireTranslate] = useState(true);
  const [requireVideoGeneration, setRequireVideoGeneration] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [processingDocumentId, setProcessingDocumentId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("Choose a PDF file before uploading.");
      }

      return uploadDocument(
        {
          file: selectedFile,
          require_translate: requireTranslate,
          require_video_generation: requireVideoGeneration,
        },
        getToken,
        (event) => {
          if (!event.total) {
            return;
          }

          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      );
    },
    onSuccess: (response) => {
      toast.success("Document accepted for processing.");
      setProcessingDocumentId(response.data.id);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      setUploadProgress(null);
    },
  });

  const isUploading = uploadMutation.isPending;

  const statusQuery = useQuery({
    queryKey: ["document-status", processingDocumentId],
    enabled: isLoaded && Boolean(processingDocumentId),
    queryFn: () => getDocumentStatus(processingDocumentId!, getToken),
    refetchInterval: (query) =>
      isDocumentTerminal(query.state.data?.data.status) ? false : 2000,
  });

  const documentStatus = statusQuery.data?.data;

  useEffect(() => {
    if (!isLoaded || !processingDocumentId) return;
    let isActive = true;
    let eventSource: EventSource | null = null;
    createAuthorizedEventSource(`/documents/${processingDocumentId}/status/stream`, getToken)
      .then((source) => {
        if (!isActive) {
          source.close();
          return;
        }
        eventSource = source;
        source.onmessage = (event) => {
          const payload = parseSsePayload<DocumentStatusStreamEvent>(event.data);
          if (payload?.data) {
            queryClient.setQueryData(["document-status", processingDocumentId], { data: payload.data });
          }
        };
        source.onerror = () => source.close();
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
      eventSource?.close();
    };
  }, [getToken, processingDocumentId, isLoaded, queryClient]);

  useEffect(() => {
    if (documentStatus?.status === "ready") {
      startTransition(() => {
        router.push(`/library/${processingDocumentId}`);
      });
    }
  }, [documentStatus?.status, processingDocumentId, router]);

  function onFileChange(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast.error("Only PDF uploads are supported in the MVP flow.");
      return;
    }

    setSelectedFile(file);
    setUploadProgress(null);
    setProcessingDocumentId(null);
    uploadMutation.reset();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col md:flex-row gap-10 md:gap-8 px-6 py-8 md:py-12 min-h-[calc(100vh-60px)] pb-8">
      {/* Left Sidebar */}
      <div className="w-full md:w-[340px] shrink-0 flex flex-col gap-6 md:sticky md:top-[92px] md:self-start">
        <div className="flex items-center justify-between">
          <Link href={"/home"}>
            <HugeiconsIcon icon={ArrowLeft04Icon} size={18} className="fill-current text-foreground" />
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <HugeiconsIcon icon={Upload01Icon} size={18} className="fill-current text-foreground" />
            Upload
          </div>
        </div>

        <div>
          <h1 className="mt-6 text-[32px] font-serif tracking-normal text-foreground leading-tight">
            Turn a paper into a reader workspace
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Upload a PDF and let the backend extract structure, build translations, generate glossary terms, and optionally prepare the video job pipeline.
          </p>
        </div>

        <div className="mt-2 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <span className="text-[9px]">▼</span>
              Required
            </div>
            <div className="mt-3 pl-[18px] text-[14px] leading-relaxed text-muted-foreground/90">
              <div className="flex items-start gap-2">
                <span className="mt-[1px] select-none text-[12px] leading-tight text-muted-[0.8]">•</span>
                <div>
                  <strong className="font-medium text-foreground">PDF file</strong> - A research paper or study material in PDF format.
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <span className="text-[9px]">▶</span>
              Optional
            </div>
            <div className="mt-3 space-y-4 pl-[18px] text-[14px] leading-relaxed text-muted-foreground/90">
              <label className="flex cursor-pointer items-start gap-3 hover:text-foreground">
                <input
                  type="checkbox"
                  className="mt-[5px] size-3.5 shrink-0 rounded-[3px] border-border accent-foreground"
                  checked={requireTranslate}
                  disabled={isUploading || Boolean(processingDocumentId)}
                  onChange={(e) => setRequireTranslate(e.target.checked)}
                />
                <div>
                  <strong className="font-medium text-foreground">Generate translations</strong> - Build bilingual paragraph output and translation retry support.
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 hover:text-foreground">
                <input
                  type="checkbox"
                  className="mt-[5px] size-3.5 shrink-0 rounded-[3px] border-border accent-foreground"
                  checked={requireVideoGeneration}
                  disabled={isUploading || Boolean(processingDocumentId)}
                  onChange={(e) => setRequireVideoGeneration(e.target.checked)}
                />
                <div>
                  <strong className="font-medium text-foreground">Prepare video generation</strong> - Keep the document ready for create-or-resume video jobs.
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <div className="relative flex flex-1 items-center justify-center min-h-[400px]">
          {processingDocumentId ? (
            <div className="flex w-full max-w-xl flex-col items-center rounded-2xl border border-border bg-background p-10 shadow-sm">
              {documentStatus?.status === "error" ? (
                <div className="flex w-full flex-col items-center text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <HugeiconsIcon icon={Alert02Icon} size={32} />
                  </div>
                  <h3 className="mb-2 text-xl font-medium text-foreground">Processing failed</h3>
                  <p className="mb-8 text-muted-foreground">There was an error while extracting and processing this document.</p>
                  <Button variant="outline" onClick={() => { setProcessingDocumentId(null); setSelectedFile(null); uploadMutation.reset(); }}>
                    Upload another file
                  </Button>
                </div>
              ) : (
                <div className="w-full">
                  <div className="mb-10 flex flex-col items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="mb-6 h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary"
                    />
                    <h3 className="text-center text-xl font-medium text-foreground">
                      Analyzing document...
                    </h3>
                  </div>

                  <div className="space-y-6 px-4">
                    {documentStatus?.stages.map((stage) => {
                      const isPending = stage.status === "pending" || stage.status === "queued";
                      const isActive = stage.status === "processing";
                      const isDone = stage.status === "done" || stage.status === "ready";
                      const isError = stage.status === "error" || stage.status === "failed";

                      return (
                        <div key={stage.name} className="flex items-center gap-5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                            {isDone ? (
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} className="text-primary" />
                            ) : isError ? (
                              <HugeiconsIcon icon={Alert02Icon} size={18} className="text-destructive" />
                            ) : isActive ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                className="size-4 rounded-full border-2 border-muted-foreground/30 border-t-foreground"
                              />
                            ) : (
                              <div className="size-2 rounded-full bg-muted-foreground/30" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[15px] font-medium ${isPending ? "text-muted-foreground/50" : "text-foreground"}`}>
                              {titleCase(stage.name.replace(/_/g, " "))}
                            </p>
                            {isActive && stage.progress_pct !== null && (
                              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="h-full bg-primary transition-all duration-300 ease-out"
                                  style={{ width: `${stage.progress_pct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <label className="relative flex w-full max-w-xl cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background py-[72px] transition-colors hover:bg-muted/30">
              <input
                type="file"
                className="hidden"
                accept="application/pdf"
                disabled={!isLoaded || isUploading}
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              />
              {!selectedFile ? (
                <div className="flex flex-col items-center gap-5 px-4 text-center">
                  <p className="text-[15px] text-muted-foreground">
                    Click to upload or drag in PDF to start tracking
                  </p>
                  <div className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm">
                    <HugeiconsIcon icon={Upload01Icon} size={16} />
                    Upload file
                  </div>
                </div>
              ) : (
                <div className="flex w-full max-w-md flex-col items-center px-6">
                  <div className="mb-6 flex w-full items-center gap-4 rounded-xl border border-border bg-background p-4 text-left shadow-sm">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <HugeiconsIcon icon={File01Icon} size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-foreground">
                        {selectedFile.name}
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {uploadProgress !== null && (
                    <div className="w-full">
                      <div className="mb-2 flex items-center justify-between text-[13px] font-medium text-muted-foreground">
                        <span>Upload progress</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-foreground transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </label>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="flex shrink-0 items-center justify-end gap-3 pt-4">
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!selectedFile || !isLoaded || isUploading || Boolean(processingDocumentId)}
            className="min-w-[90px] px-6"
          >
            {isUploading ? "Uploading..." : processingDocumentId ? "Processing..." : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}
