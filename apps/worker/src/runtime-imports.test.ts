import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const workerSrcDir = path.join(process.cwd(), "src");
const relativeImportPattern =
  /from\s+["'](\.\.?\/[^"']+)["']|import\s*\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g;

async function collectTypeScriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectTypeScriptFiles(entryPath);
      }

      if (!entry.isFile() || !entry.name.endsWith(".ts")) {
        return [];
      }

      return [entryPath];
    }),
  );

  return files.flat();
}

describe("worker runtime imports", () => {
  it("uses explicit .ts extensions for relative imports in source files", async () => {
    const files = await collectTypeScriptFiles(workerSrcDir);
    const missingExtensions: string[] = [];

    for (const file of files) {
      if (file.endsWith(".test.ts")) {
        continue;
      }

      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(relativeImportPattern)) {
        const specifier = match[1] ?? match[2];
        if (
          specifier &&
          !specifier.endsWith(".ts") &&
          !specifier.endsWith(".js") &&
          !specifier.endsWith(".json")
        ) {
          missingExtensions.push(`${path.relative(process.cwd(), file)} -> ${specifier}`);
        }
      }
    }

    assert.deepEqual(
      missingExtensions,
      [],
      `worker source files must use explicit runtime import extensions:\n${missingExtensions.join("\n")}`,
    );
  });
});
