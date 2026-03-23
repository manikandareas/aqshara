import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type LoadWorkspaceEnvOptions = {
  cwd?: string;
};

export function loadWorkspaceEnv(options: LoadWorkspaceEnvOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const workspaceRoot = resolve(cwd, "../..");
  const candidates = [
    resolve(cwd, ".env.local"),
    resolve(cwd, ".env"),
    resolve(workspaceRoot, ".env.local"),
    resolve(workspaceRoot, ".env"),
  ];
  const loadedFiles: string[] = [];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    process.loadEnvFile(filePath);
    loadedFiles.push(filePath);
  }

  return loadedFiles;
}
