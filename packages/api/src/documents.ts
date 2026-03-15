import type { AxiosProgressEvent } from "axios";
import { apiRequest } from "./client";
import type {
  DocumentDetailEnvelope,
  DocumentItemEnvelope,
  DocumentListEnvelope,
  DocumentStatusEnvelope,
  GlossaryDetailEnvelope,
  GlossaryListEnvelope,
  GlossaryLookupEnvelope,
  GlossaryLookupParams,
  ListDocumentsParams,
  ListGlossaryParams,
  ListParagraphsParams,
  ListTranslationsParams,
  MapNodeDetailEnvelope,
  MapTreeEnvelope,
  OutlineEnvelope,
  ParagraphListEnvelope,
  SearchEnvelope,
  SearchParagraphsParams,
  TranslationRetryEnvelope,
  TranslationsListEnvelope,
  UploadDocumentInput,
} from "./contracts";
import type { TokenProvider } from "./client";

export async function listDocuments(
  params: ListDocumentsParams,
  getToken: TokenProvider,
) {
  return apiRequest<DocumentListEnvelope>(
    {
      method: "GET",
      url: "/documents",
      params,
    },
    getToken,
  );
}

export async function uploadDocument(
  input: UploadDocumentInput,
  getToken: TokenProvider,
  onUploadProgress?: (event: AxiosProgressEvent) => void,
) {
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("require_translate", String(input.require_translate));
  formData.set(
    "require_video_generation",
    String(input.require_video_generation),
  );

  return apiRequest<DocumentItemEnvelope>(
    {
      method: "POST",
      url: "/documents",
      data: formData,
      onUploadProgress,
    },
    getToken,
  );
}

export async function getDocument(documentId: string, getToken: TokenProvider) {
  const response = await apiRequest<DocumentDetailEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}`,
    },
    getToken,
  );

  return {
    ...response,
    data: {
      ...response.data,
      video: response.data.video ?? null,
    },
  };
}

export async function deleteDocument(documentId: string, getToken: TokenProvider) {
  return apiRequest<void>(
    {
      method: "DELETE",
      url: `/documents/${documentId}`,
    },
    getToken,
  );
}

export async function getDocumentStatus(
  documentId: string,
  getToken: TokenProvider,
) {
  return apiRequest<DocumentStatusEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/status`,
    },
    getToken,
  );
}

export async function getOutline(documentId: string, getToken: TokenProvider) {
  return apiRequest<OutlineEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/outline`,
    },
    getToken,
  );
}

export async function listParagraphs(
  documentId: string,
  params: ListParagraphsParams,
  getToken: TokenProvider,
) {
  return apiRequest<ParagraphListEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/paragraphs`,
      params,
    },
    getToken,
  );
}

export async function searchParagraphs(
  documentId: string,
  params: SearchParagraphsParams,
  getToken: TokenProvider,
) {
  return apiRequest<SearchEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/search`,
      params,
    },
    getToken,
  );
}

export async function listTranslations(
  documentId: string,
  params: ListTranslationsParams,
  getToken: TokenProvider,
) {
  return apiRequest<TranslationsListEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/translations`,
      params,
    },
    getToken,
  );
}

export async function retryTranslation(
  documentId: string,
  paragraphId: string,
  getToken: TokenProvider,
) {
  return apiRequest<TranslationRetryEnvelope>(
    {
      method: "POST",
      url: `/documents/${documentId}/translations/${paragraphId}/retry`,
    },
    getToken,
  );
}

export async function listGlossary(
  documentId: string,
  params: ListGlossaryParams,
  getToken: TokenProvider,
) {
  return apiRequest<GlossaryListEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/glossary`,
      params,
    },
    getToken,
  );
}

export async function lookupGlossaryTerm(
  documentId: string,
  params: GlossaryLookupParams,
  getToken: TokenProvider,
) {
  return apiRequest<GlossaryLookupEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/glossary/lookup`,
      params,
    },
    getToken,
  );
}

export async function getGlossaryTerm(
  documentId: string,
  termId: string,
  getToken: TokenProvider,
) {
  return apiRequest<GlossaryDetailEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/glossary/${termId}`,
    },
    getToken,
  );
}

export async function getMapTree(documentId: string, getToken: TokenProvider) {
  return apiRequest<MapTreeEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/map`,
    },
    getToken,
  );
}

export async function getMapNodeDetail(
  documentId: string,
  nodeId: string,
  getToken: TokenProvider,
) {
  return apiRequest<MapNodeDetailEnvelope>(
    {
      method: "GET",
      url: `/documents/${documentId}/map/${nodeId}`,
    },
    getToken,
  );
}
