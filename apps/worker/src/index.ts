import { loadWorkspaceEnv } from "@aqshara/config/load-env";
import { UnrecoverableError, Worker, type Job } from "bullmq";
import { getRedisConnection } from "@aqshara/config";
import { createLogger } from "@aqshara/observability";
import {
  exportDocxJobName,
  exportDocxPayloadSchema,
  queueNames,
} from "@aqshara/queue";
import { processExportDocxJob } from "./jobs/export-docx.js";

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

exportWorker.on("ready", () => {
  logger.info(`Worker ready for queue ${queueNames.exportDocx}`);
});

exportWorker.on("failed", (job, error) => {
  logger.error(`Job ${job?.id ?? "unknown"} failed`, error);
});

exportWorker.on("completed", (job) => {
  logger.info(
    `Job ${job.id} completed exportId=${(job.data as { exportId?: string })?.exportId ?? ""}`,
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
    await exportWorker.close();
    logger.info("Worker closed");
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
