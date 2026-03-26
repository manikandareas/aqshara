import { loadWorkspaceEnv } from "@aqshara/config/load-env";
import { UnrecoverableError, Worker, type Job } from "bullmq";
import { getRedisConnection } from "@aqshara/config";
import { createLogger } from "@aqshara/observability";
import {
  exportDocxJobName,
  exportDocxPayloadSchema,
  parseSourceJobName,
  parseSourcePayloadSchema,
  queueNames,
} from "@aqshara/queue";
import { processExportDocxJob } from "./jobs/export-docx.js";
import { processSourceParseJob } from "./jobs/source-parse.js";

loadWorkspaceEnv();

const logger = createLogger("worker");
const connection = getRedisConnection();

const exportWorker = new Worker(
  queueNames.exportDocx,
  async (job: Job) => {
    if (job.name !== exportDocxJobName) {
      throw new Error(`No handler registered for job ${job.name}`);
    }

    const parsed = exportDocxPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(
        `Invalid export job payload: ${parsed.error.message}`,
      );
    }

    await processExportDocxJob(parsed.data, String(job.id ?? ""), {
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
    });
  },
  { connection },
);

const parseSourceWorker = new Worker(
  queueNames.parseSource,
  async (job: Job) => {
    if (job.name !== parseSourceJobName) {
      throw new Error(`No handler registered for job ${job.name}`);
    }

    const parsed = parseSourcePayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(
        `Invalid parse_source job payload: ${parsed.error.message}`,
      );
    }

    await processSourceParseJob(parsed.data, String(job.id ?? ""), {
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
    });
  },
  { connection },
);

exportWorker.on("ready", () => {
  logger.info(`Worker ready for queue ${queueNames.exportDocx}`);
});

parseSourceWorker.on("ready", () => {
  logger.info(`Worker ready for queue ${queueNames.parseSource}`);
});

exportWorker.on("failed", (job, error) => {
  logger.error(`Job ${job?.id ?? "unknown"} failed`, error);
});

parseSourceWorker.on("failed", (job, error) => {
  logger.error(`Job ${job?.id ?? "unknown"} failed`, error);
});

exportWorker.on("completed", (job) => {
  logger.info(
    `Job ${job.id} completed exportId=${(job.data as { exportId?: string })?.exportId ?? ""}`,
  );
});

parseSourceWorker.on("completed", (job) => {
  logger.info(
    `Job ${job.id} completed sourceId=${(job.data as { sourceId?: string })?.sourceId ?? ""}`,
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info(`Received ${signal}; closing worker`);

  try {
    await Promise.all([exportWorker.close(), parseSourceWorker.close()]);
    logger.info("Workers closed");
    process.exit(0);
  } catch (error) {
    logger.error("Worker shutdown failed", error);
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
