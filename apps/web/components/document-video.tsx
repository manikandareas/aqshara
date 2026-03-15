"use client";

import { useAuth } from "@clerk/nextjs";
import { Alert02Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { SmokeBackground } from "@/components/ui/spooky-smoke-animation";
import {
  createAuthorizedEventSource,
  getVideoJobStatus,
  parseSsePayload,
} from "@aqshara/api";
import type {
  DocumentVideoSummary,
  VideoJobStatusStreamEvent,
} from "@aqshara/api";
import { titleCase } from "@/lib/format";

export function DocumentVideo({
  documentId,
  video,
}: {
  documentId: string;
  video: DocumentVideoSummary;
}) {
  const { getToken, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const hasRequestedDocumentRefreshRef = useRef(false);

  const isTerminal =
    video.status === "completed" ||
    video.status === "failed" ||
    video.status === "canceled";

  const statusQuery = useQuery({
    queryKey: ["video-status", video.job_id],
    enabled: isLoaded && !isTerminal,
    queryFn: () => getVideoJobStatus(video.job_id, getToken),
    refetchInterval: (query) => {
      const status = query.state.data?.data.status;
      return status === "completed" ||
        status === "failed" ||
        status === "canceled"
        ? false
        : 2000;
    },
  });

  const statusData = statusQuery.data?.data;
  const currentStatus = statusData?.status ?? video.status;
  const currentStage = statusData?.pipeline_stage ?? video.pipeline_stage;
  const currentProgress = statusData?.progress_pct ?? video.progress_pct;

  const refreshDocument = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["document", documentId],
      refetchType: "active",
    });
  }, [documentId, queryClient]);

  useEffect(() => {
    if (!isLoaded || isTerminal) return;

    let isActive = true;
    let eventSource: EventSource | null = null;

    createAuthorizedEventSource(
      `/video-jobs/${video.job_id}/status/stream`,
      getToken,
    )
      .then((source) => {
        if (!isActive) {
          source.close();
          return;
        }
        eventSource = source;
        source.onmessage = (event) => {
          const payload = parseSsePayload<VideoJobStatusStreamEvent>(
            event.data,
          );
          if (payload?.data) {
            queryClient.setQueryData(["video-status", video.job_id], {
              data: payload.data,
            });

            if (
              payload.data.status === "completed" ||
              payload.data.status === "failed" ||
              payload.data.status === "canceled"
            ) {
              // Refetch document query to get fresh video URL and thumbnail.
              refreshDocument();
            }
          }
        };
        source.onerror = () => source.close();
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      eventSource?.close();
    };
  }, [getToken, video.job_id, isLoaded, isTerminal, refreshDocument]);

  useEffect(() => {
    hasRequestedDocumentRefreshRef.current = false;
  }, [video.job_id]);

  useEffect(() => {
    const needsDocumentRefresh =
      currentStatus === "completed" && !video.video_url;

    if (!needsDocumentRefresh || hasRequestedDocumentRefreshRef.current) {
      return;
    }

    hasRequestedDocumentRefreshRef.current = true;
    refreshDocument();
  }, [currentStatus, video.video_url, refreshDocument]);

  if (currentStatus === "failed" || currentStatus === "canceled") {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 flex flex-col items-center justify-center text-center gap-3">
        <HugeiconsIcon
          icon={Alert02Icon}
          size={32}
          className="text-destructive/80"
        />
        <div>
          <h3 className="font-medium text-destructive">
            Video Generation {titleCase(currentStatus)}
          </h3>
          <p className="text-sm text-destructive/80 mt-1">
            There was an error generating the video for this document.
          </p>
        </div>
      </div>
    );
  }

  if (currentStatus === "completed" && video.video_url) {
    const videoUrl =
      typeof video.video_url === "string" ? video.video_url : "";
    return (
      <div className="rounded-2xl overflow-hidden border border-border/60 bg-background shadow-sm relative aspect-video">
        <iframe
          src={videoUrl}
          loading="lazy"
          style={{
            border: "0",
            position: "absolute",
            top: "0",
            height: "100%",
            width: "100%",
          }}
          allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
          allowFullScreen
        />
      </div>
    );
  }

  // Processing or Queued state
  return (
    <div className="relative mx-auto w-[85%] max-w-4xl overflow-hidden rounded-2xl border border-border/40 bg-zinc-950 aspect-video">
      {/* Smoke animated background */}
      <div className="absolute inset-0">
        <SmokeBackground smokeColor="#3f3f46" />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8">
        <div className="flex flex-col items-center max-w-sm w-full">
          {/* Icon & Progress Ring */}
          <div className="relative flex items-center justify-center w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full bg-white/5 backdrop-blur-sm border border-white/10" />
            <HugeiconsIcon
              icon={Video01Icon}
              size={24}
              className="text-white/80"
            />
            <svg
              className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-md"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${currentProgress * 3.01} 301`}
                className="text-white/60 transition-all duration-700 ease-out"
              />
            </svg>
          </div>

          {/* Text & Status */}
          <div className="text-center space-y-1.5">
            <h3 className="text-lg font-medium tracking-tight text-white/95">
              Generating Video
            </h3>
            <p className="text-sm text-white/50">
              {titleCase(currentStage.replace(/_/g, " "))}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="flex items-center justify-between px-6 pb-3 text-[11px] font-medium uppercase tracking-wider text-white/40">
          <span>Progress</span>
          <span className="text-white/70 tabular-nums">{currentProgress}%</span>
        </div>
        <div className="h-1 w-full bg-white/10 backdrop-blur-sm">
          <div
            className="h-full bg-gradient-to-r from-white/40 to-white/80 transition-all duration-700 ease-out"
            style={{ width: `${currentProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
