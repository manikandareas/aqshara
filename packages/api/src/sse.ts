import { getApiBaseUrl } from "./client";
import type { TokenProvider } from "./client";

function createSseUrl(pathname: string, token: string | null) {
  const url = new URL(
    pathname.replace(/^\/+/, ""),
    `${getApiBaseUrl().replace(/\/+$/g, "")}/`,
  );

  if (token) {
    url.searchParams.set("access_token", token);
  }

  return url.toString();
}

export async function createAuthorizedEventSource(
  pathname: string,
  getToken: TokenProvider,
) {
  const token = await getToken();
  return new EventSource(createSseUrl(pathname, token));
}

export function parseSsePayload<T>(rawValue: string) {
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}
