import createFetchClient from "openapi-fetch";
import createQueryClient from "openapi-react-query";
import { getPublicApiBaseUrl } from "@aqshara/config/client";
import type { paths } from "./generated/types.js";

export * from "./generated/types.js";

export function createApiClient() {
  return createFetchClient<paths>({
    baseUrl: getPublicApiBaseUrl(),
  });
}

export function createApiQueryClient() {
  return createQueryClient(createApiClient());
}
