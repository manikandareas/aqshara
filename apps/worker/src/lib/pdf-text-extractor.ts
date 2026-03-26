const MIN_CHARS_WEAK_PAGE = 48;

export type PdfPageTexts = {
  numPages: number;
  pages: string[];
};

export async function extractPdfPageTexts(
  pdfBuffer: Buffer,
): Promise<PdfPageTexts> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    verbosity: 0,
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= numPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const parts = textContent.items.map((item) =>
      item && typeof item === "object" && "str" in item
        ? String((item as { str: string }).str)
        : "",
    );
    pages.push(parts.join(" ").replace(/\s+/g, " ").trim());
  }

  return { numPages, pages };
}

export function pageIndicesNeedingOcr(pages: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    if (pages[i]!.length < MIN_CHARS_WEAK_PAGE) {
      out.push(i);
    }
  }
  return out;
}
