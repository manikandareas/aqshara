import { loadWorkspaceEnv } from "@aqshara/config/load-env";
import { UnrecoverableError, Worker, type Job } from "bullmq";
import { getRedisConnection } from "@aqshara/config";
import { createLogger } from "@aqshara/observability";
import {
  createDatabase,
  exportsTable,
  sourcesTable,
} from "@aqshara/database";
import { and, eq, isNotNull } from "drizzle-orm";
import { markExportFailed } from "@aqshara/database/export-job";
import { markSourceFailed } from "@aqshara/database/source-job";
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
const RECOVERY_STALE_MS = Number(process.env.WORKER_RECOVERY_STALE_MS ?? 15 * 60 * 1000);

async function reconcileStuckJobs(): Promise<void> {
  const db = createDatabase();
  const cutoff = Date.now() - RECOVERY_STALE_MS;

  const staleExports = await db
    .select()
    .from(exportsTable)
    .where(and(eq(exportsTable.status, "processing"), isNotNull(exportsTable.processingStartedAt)));

  for (const row of staleExports) {
    const startedAt = row.processingStartedAt?.getTime() ?? 0;
    if (startedAt > cutoff) {
      continue;
    }

    await markExportFailed(db, {
      exportId: row.id,
      errorCode: "worker_recovered_stale_processing",
      errorMessage: "Export was recovered after worker restart",
    });
  }

  const staleSources = await db
    .select()
    .from(sourcesTable)
    .where(and(eq(sourcesTable.status, "processing"), isNotNull(sourcesTable.processingStartedAt)));

  for (const row of staleSources) {
    const startedAt = row.processingStartedAt?.getTime() ?? 0;
    if (startedAt > cutoff) {
      continue;
    }

    await markSourceFailed(db, {
      sourceId: row.id,
      errorCode: "worker_recovered_stale_processing",
      errorMessage: "Source was recovered after worker restart",
    });
  }
}

void reconcileStuckJobs().catch((error) => {
  logger.error("Worker recovery sweep failed", error);
});

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

exportWorker.on("stalled", (jobId) => {
  logger.warn(`Export job stalled jobId=${jobId}`);
});

exportWorker.on("error", (error) => {
  logger.error("Export worker error", error);
});

parseSourceWorker.on("failed", (job, error) => {
  logger.error(`Job ${job?.id ?? "unknown"} failed`, error);
});

parseSourceWorker.on("stalled", (jobId) => {
  logger.warn(`Source job stalled jobId=${jobId}`);
});

parseSourceWorker.on("error", (error) => {
  logger.error("Source worker error", error);
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
