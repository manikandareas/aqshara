import { apiRequest } from "./client";
import type {
  CatalogDetailEnvelope,
  CatalogSearchEnvelope,
  CatalogSource,
} from "./contracts";

export type SearchCatalogParams = {
  q: string;
  limit?: number;
};

export type ListCatalogParams = {
  limit?: number;
};

export type GetCatalogItemParams = {
  source: CatalogSource;
  source_id: string;
};

export async function listCatalog(params?: ListCatalogParams) {
  return apiRequest<CatalogSearchEnvelope>(
    {
      method: "GET",
      url: "/catalog",
      params: {
        limit: params?.limit,
      },
    },
    undefined, // public endpoint, no token
  );
}

export async function searchCatalog(params: SearchCatalogParams) {
  return apiRequest<CatalogSearchEnvelope>(
    {
      method: "GET",
      url: "/catalog/search",
      params: {
        q: params.q.trim(),
        limit: params.limit,
      },
    },
    undefined, // public endpoint, no token
  );
}

export async function getCatalogItem(params: GetCatalogItemParams) {
  return apiRequest<CatalogDetailEnvelope>(
    {
      method: "GET",
      url: "/catalog/item",
      params: {
        source: params.source,
        source_id: params.source_id.trim(),
      },
    },
    undefined, // public endpoint, no token
  );
}
