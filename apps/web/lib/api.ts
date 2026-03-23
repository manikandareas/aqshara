import type { DocumentAst } from "@aqshara/documents";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000";

export type ApiErrorResponse = {
  code: string;
  message: string;
  requestId: string;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(input: {
    status: number;
    message: string;
    code?: string | null;
    requestId?: string | null;
  }) {
    super(input.message);
    this.name = "ApiRequestError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.requestId = input.requestId ?? null;
  }
}

export type ApiSession = {
  user: {
    id: string;
    clerkUserId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    planCode: "free";
  };
  workspace: {
    id: string;
    userId: string;
    name: string;
  };
  plan: {
    code: "free";
    label: "Free";
  };
  usage: {
    aiActionsRemaining: number;
    exportsRemaining: number;
    sourceUploadsRemaining: number;
  };
};

export type ApiDocument = {
  id: string;
  workspaceId: string;
  title: string;
  type: "general_paper" | "proposal" | "skripsi";
  contentJson: DocumentAst;
  plainText: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object"
    && value !== null
    && "code" in value
    && "message" in value
    && typeof value.code === "string"
    && typeof value.message === "string"
    && "requestId" in value
    && typeof value.requestId === "string"
  );
}

async function toApiRequestError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as unknown;

    if (isApiErrorResponse(payload)) {
      return new ApiRequestError({
        status: response.status,
        code: payload.code,
        message: payload.message,
        requestId: payload.requestId,
      });
    }
  }

  const text = await response.text();
  return new ApiRequestError({
    status: response.status,
    message: text || `API request failed: ${response.status}`,
  });
}

async function apiRequest<T>(
  path: string,
  init: RequestInit & { token: string },
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${init.token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw await toApiRequestError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchSession(token: string) {
  return apiRequest<ApiSession>("/v1/me", {
    method: "GET",
    token,
  });
}

export async function fetchDocuments(token: string, status: "active" | "archived" = "active") {
  return apiRequest<{ documents: ApiDocument[] }>(`/v1/documents?status=${status}`, {
    method: "GET",
    token,
  });
}

export async function fetchDocument(token: string, documentId: string) {
  return apiRequest<{ document: ApiDocument }>(`/v1/documents/${documentId}`, {
    method: "GET",
    token,
  });
}

export async function createDocument(
  token: string,
  input: { title: string; type: ApiDocument["type"] },
) {
  return apiRequest<{ document: ApiDocument }>("/v1/documents", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function updateDocumentMetadata(
  token: string,
  documentId: string,
  input: { title?: string; type?: ApiDocument["type"] },
) {
  return apiRequest<{ document: ApiDocument }>(`/v1/documents/${documentId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

export async function saveDocumentContent(
  token: string,
  documentId: string,
  contentJson: DocumentAst,
) {
  return apiRequest<{ document: ApiDocument }>(`/v1/documents/${documentId}/content`, {
    method: "PUT",
    token,
    body: JSON.stringify({ contentJson }),
  });
}

export async function archiveDocument(token: string, documentId: string) {
  return apiRequest<{ document: ApiDocument }>(`/v1/documents/${documentId}/archive`, {
    method: "POST",
    token,
  });
}

export async function deleteDocument(token: string, documentId: string) {
  return apiRequest<void>(`/v1/documents/${documentId}`, {
    method: "DELETE",
    token,
  });
}
