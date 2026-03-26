import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type StorageObject = {
  key: string;
  contentType: string;
  size: number;
};

export function createStorageKey(...segments: string[]) {
  return segments.join("/");
}

/** Root directory for persisted export files (DOCX). Override with AQSHARA_EXPORTS_DIR. */
export function getExportsRootDir(): string {
  return process.env.AQSHARA_EXPORTS_DIR ?? join(process.cwd(), ".data", "exports");
}

/** Write binary object under the exports root. `key` is relative (e.g. userId/exportId.docx). */
export async function writeExportFile(
  key: string,
  data: Buffer,
): Promise<void> {
  const fullPath = join(getExportsRootDir(), key);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data);
}

export async function readExportFile(key: string): Promise<Buffer> {
  const fullPath = join(getExportsRootDir(), key);
  return readFile(fullPath);
}
