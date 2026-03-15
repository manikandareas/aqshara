import { apiRequest } from "./client";
import type {
  CreateVideoJobRequest,
  RetryVideoJobRequest,
  VideoJobEnvelope,
  VideoJobResultEnvelope,
  VideoJobStatusEnvelope,
} from "./contracts";
import type { TokenProvider } from "./client";

export async function createVideoJob(
  input: CreateVideoJobRequest,
  getToken: TokenProvider,
) {
  return apiRequest<VideoJobEnvelope>(
    {
      method: "POST",
      url: "/video-jobs",
      data: input,
    },
    getToken,
  );
}

export async function getVideoJob(jobId: string, getToken: TokenProvider) {
  return apiRequest<VideoJobEnvelope>(
    {
      method: "GET",
      url: `/video-jobs/${jobId}`,
    },
    getToken,
  );
}

export async function getVideoJobStatus(
  jobId: string,
  getToken: TokenProvider,
) {
  return apiRequest<VideoJobStatusEnvelope>(
    {
      method: "GET",
      url: `/video-jobs/${jobId}/status`,
    },
    getToken,
  );
}

export async function retryVideoJob(
  jobId: string,
  input: RetryVideoJobRequest,
  getToken: TokenProvider,
) {
  return apiRequest<VideoJobEnvelope>(
    {
      method: "POST",
      url: `/video-jobs/${jobId}/retry`,
      data: input,
    },
    getToken,
  );
}

export async function getVideoJobResult(
  jobId: string,
  getToken: TokenProvider,
) {
  return apiRequest<VideoJobResultEnvelope>(
    {
      method: "GET",
      url: `/video-jobs/${jobId}/result`,
    },
    getToken,
  );
}
