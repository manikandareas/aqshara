import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadWorkspaceEnv } from "./load-env.ts";

test("loadWorkspaceEnv loads package env files before workspace fallbacks", () => {
  const rootOnlyKey = "AQSHARA_ONLY_ROOT";
  const priorityKey = "AQSHARA_PRIORITY";
  const rootDir = mkdtempSync(join(tmpdir(), "aqshara-config-root-"));
  const appDir = join(rootDir, "apps", "api");
  mkdirSync(appDir, { recursive: true });

  writeFileSync(join(rootDir, ".env"), `${rootOnlyKey}=from-root\n${priorityKey}=workspace\n`);
  writeFileSync(join(appDir, ".env"), `${priorityKey}=package\n`);
  writeFileSync(join(appDir, ".env.local"), `${priorityKey}=package-local\n`);

  delete process.env[rootOnlyKey];
  delete process.env[priorityKey];

  const loadedFiles = loadWorkspaceEnv({ cwd: appDir });

  assert.equal(process.env[rootOnlyKey], "from-root");
  assert.equal(process.env[priorityKey], "package-local");
  assert.deepEqual(loadedFiles, [
    join(appDir, ".env.local"),
    join(appDir, ".env"),
    join(rootDir, ".env"),
  ]);

  delete process.env[rootOnlyKey];
  delete process.env[priorityKey];
  rmSync(rootDir, { recursive: true, force: true });
});
