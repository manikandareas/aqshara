import { createApiClient, type paths } from "@aqshara/api-client"
import { getAuthHeader } from "@aqshara/auth"

export type ApiErrorPayload = {
  code?: string
  message?: string
  requestId?: string
}

type ApiHeaders = Record<string, string>
type ApiRequestOptions = {
  body?: unknown
  headers?: unknown
  params?: unknown
}
type ApiResult<TData = unknown> = {
  data?: TData
  error?: ApiErrorPayload
  response: Response
}

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: () => Promise<string | null>
      }
    }
  }
}

export class ApiRequestError extends Error {
  status: number
  code: string | null
  requestId: string | null

  constructor(
    status: number,
    message: string,
    code?: string | null,
    requestId?: string | null
  ) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = code ?? null
    this.requestId = requestId ?? null
  }
}

async function getClerkToken() {
  if (typeof window !== "undefined") {
    return (await window.Clerk?.session?.getToken()) ?? null
  }

  const { auth } = await import("@clerk/tanstack-react-start/server")
  const serverAuth = auth() as {
    getToken?: () => Promise<string | null> | string | null
  }

  if (!serverAuth.getToken) {
    return null
  }

  return await serverAuth.getToken()
}

function normalizeHeaders(headers?: unknown): ApiHeaders {
  if (!headers) {
    return {}
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }

  return Object.entries(headers).reduce<ApiHeaders>((result, [key, value]) => {
    if (value === undefined) {
      return result
    }

    result[key] = String(value)
    return result
  }, {})
}

export async function getApiAuthHeaders(headers?: unknown) {
  const token = await getClerkToken()

  return {
    ...(token ? getAuthHeader(token) : {}),
    ...normalizeHeaders(headers),
  }
}

export function toApiRequestError(
  status: number,
  payload: ApiErrorPayload | undefined,
  fallbackMessage: string
) {
  return new ApiRequestError(
    status,
    payload?.message ?? fallbackMessage,
    payload?.code,
    payload?.requestId
  )
}

export function isApiRequestErrorStatus(error: unknown, status: number) {
  return error instanceof ApiRequestError && error.status === status
}

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again."
) {
  if (error instanceof ApiRequestError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

export function requireApiData<T>(data: T | undefined, message: string) {
  if (data === undefined) {
    throw new ApiRequestError(500, message)
  }

  return data
}

function withAuthHeaders(options?: ApiRequestOptions) {
  return async () =>
    ({
      ...(options ?? {}),
      headers: await getApiAuthHeaders(options?.headers),
    }) as never
}

export async function apiGet<TData = unknown>(
  path: keyof paths & string,
  options?: ApiRequestOptions
): Promise<ApiResult<TData>> {
  const client = createApiClient()

  return client.GET(path as never, await withAuthHeaders(options)()) as Promise<
    ApiResult<TData>
  >
}

export async function apiPost<TData = unknown>(
  path: keyof paths & string,
  options?: ApiRequestOptions
): Promise<ApiResult<TData>> {
  const client = createApiClient()

  return client.POST(path as never, await withAuthHeaders(options)()) as Promise<
    ApiResult<TData>
  >
}

export async function apiPatch<TData = unknown>(
  path: keyof paths & string,
  options?: ApiRequestOptions
): Promise<ApiResult<TData>> {
  const client = createApiClient()

  return client.PATCH(path as never, await withAuthHeaders(options)()) as Promise<
    ApiResult<TData>
  >
}

export async function apiPut<TData = unknown>(
  path: keyof paths & string,
  options?: ApiRequestOptions
): Promise<ApiResult<TData>> {
  const client = createApiClient()

  return client.PUT(path as never, await withAuthHeaders(options)()) as Promise<
    ApiResult<TData>
  >
}

export async function apiDelete<TData = unknown>(
  path: keyof paths & string,
  options?: ApiRequestOptions
): Promise<ApiResult<TData>> {
  const client = createApiClient()

  return client.DELETE(path as never, await withAuthHeaders(options)()) as Promise<
    ApiResult<TData>
  >
}
