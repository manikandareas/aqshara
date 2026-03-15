import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import type { ApiErrorDetail, ApiErrorEnvelope } from "./contracts";

export type TokenProvider = () => Promise<string | null>;

export class ApiClientError extends Error {
  status: number | null;
  code: string | null;
  details: ApiErrorDetail[];

  constructor({
    message,
    status,
    code,
    details,
  }: {
    message: string;
    status: number | null;
    code: string | null;
    details: ApiErrorDetail[];
  }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";

export function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/g, "") ||
    DEFAULT_API_BASE_URL
  );
}

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    Accept: "application/json",
  },
});

function normalizeApiError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return new ApiClientError({
      message: error instanceof Error ? error.message : "Unexpected request failure",
      status: null,
      code: null,
      details: [],
    });
  }

  const response = error.response;
  const envelope = response?.data as ApiErrorEnvelope | undefined;
  const details = Array.isArray(envelope?.errors) ? envelope.errors : [];
  const firstDetail = details[0];
  
  // Handle case where backend returns { error: { message: "..." } } directly
  const backendError = response?.data as { error?: { message?: string | string[] } } | undefined;
  let backendMessage = undefined;
  if (backendError?.error?.message) {
    backendMessage = Array.isArray(backendError.error.message) 
      ? backendError.error.message[0] 
      : backendError.error.message;
  }

  return new ApiClientError({
    message: firstDetail?.message ?? backendMessage ?? error.message ?? "Request failed",
    status: response?.status ?? null,
    code: firstDetail?.code ?? null,
    details,
  });
}

export async function apiRequest<TResponse>(
  config: AxiosRequestConfig,
  getToken?: TokenProvider,
) {
  try {
    const token = getToken ? await getToken() : null;
    const response = await apiClient.request<TResponse>({
      ...config,
      headers: {
        ...config.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred";
}
