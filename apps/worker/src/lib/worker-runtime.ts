import { getMistralApiKey, getMistralApiBaseUrl } from "@aqshara/config";
import { isR2ObjectStorageConfigured } from "@aqshara/storage";

export type WorkerRuntimeConfig = {
  recoveryStaleMs: number;
  mistralOcrTimeoutMs: number;
  productionLike: boolean;
  r2Configured: boolean;
  mistralOcrConfigured: boolean;
};

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  name: string,
): number {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export function getWorkerRuntimeConfig(input: {
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string;
  r2Configured?: boolean;
  mistralApiKey?: string | null;
} = {}): WorkerRuntimeConfig {
  const env = input.env ?? process.env;
  const nodeEnv = input.nodeEnv ?? env.NODE_ENV;
  const r2Configured =
    input.r2Configured ?? isR2ObjectStorageConfigured();
  const mistralApiKey = (input.mistralApiKey ?? getMistralApiKey() ?? "").trim();

  const recoveryStaleMs = parsePositiveInteger(
    env.WORKER_RECOVERY_STALE_MS,
    15 * 60 * 1000,
    "WORKER_RECOVERY_STALE_MS",
  );
  const mistralOcrTimeoutMs = parsePositiveInteger(
    env.MISTRAL_OCR_TIMEOUT_MS,
    45 * 1000,
    "MISTRAL_OCR_TIMEOUT_MS",
  );

  if (nodeEnv === "production" && !r2Configured) {
    throw new Error(
      "Worker requires R2 object storage in production to avoid local-storage fallback",
    );
  }

  if (mistralApiKey && !r2Configured) {
    throw new Error(
      "MISTRAL_API_KEY requires R2 object storage so OCR can access uploaded source files",
    );
  }

  return {
    recoveryStaleMs,
    mistralOcrTimeoutMs,
    productionLike: nodeEnv === "production",
    r2Configured,
    mistralOcrConfigured:
      mistralApiKey.length > 0 && r2Configured && getMistralApiBaseUrl().length > 0,
  };
}
