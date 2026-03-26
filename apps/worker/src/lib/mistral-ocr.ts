import { getMistralApiBaseUrl, getMistralApiKey } from "@aqshara/config";
import {
  isR2ObjectStorageConfigured,
  presignGetSourceObject,
} from "@aqshara/storage";

export type MistralOcrResult = {
  pages: Array<{
    index: number;
    markdown: string;
  }>;
  text: string;
};

/**
 * Runs Mistral Document OCR. Prefers a presigned R2 URL when configured;
 * otherwise skips OCR (caller should treat as failure or no-op).
 */
export async function runMistralOcrOnPdfKey(input: {
  storageKey: string;
  /** 0-based page indices to send to the API; omit for full document. */
  pages?: number[];
}): Promise<MistralOcrResult | null> {
  const apiKey = getMistralApiKey();
  if (!apiKey) {
    return null;
  }

  let documentUrl: string | undefined;
  if (isR2ObjectStorageConfigured()) {
    documentUrl = await presignGetSourceObject({
      key: input.storageKey,
      expiresSeconds: 900,
    });
  }

  if (!documentUrl) {
    return null;
  }

  const base = getMistralApiBaseUrl().replace(/\/$/, "");
  const body: Record<string, unknown> = {
    model: "mistral-ocr-latest",
    document: {
      type: "document_url",
      document_url: documentUrl,
    },
  };

  if (input.pages && input.pages.length > 0) {
    body.pages = input.pages;
  }

  const res = await fetch(`${base}/v1/ocr`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Mistral OCR failed: ${res.status} ${errText.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as {
    pages?: Array<{ markdown?: string; index?: number }>;
  };

  const pages =
    json.pages
      ?.filter(
        (page): page is { markdown: string; index: number } =>
          typeof page.index === "number" &&
          typeof page.markdown === "string" &&
          page.markdown.length > 0,
      )
      .map((page) => ({
        index: page.index,
        markdown: page.markdown,
      })) ?? [];

  return {
    pages,
    text: pages.map((page) => page.markdown).join("\n\n"),
  };
}
