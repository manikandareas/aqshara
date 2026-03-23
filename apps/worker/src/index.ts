import { loadWorkspaceEnv } from "@aqshara/config/load-env";
import { Worker } from "bullmq";
import { getRedisConnection } from "@aqshara/config";
import { createLogger } from "@aqshara/observability";
import { jobHandlers, queueNames } from "@aqshara/queue";

loadWorkspaceEnv();

const logger = createLogger("worker");
const connection = getRedisConnection();

const exportWorker = new Worker(
  queueNames.exportDocx,
  async (job) => {
    const handler = jobHandlers[job.name];

    if (!handler) {
      throw new Error(`No handler registered for job ${job.name}`);
    }

    return handler(job.data);
  },
  { connection },
);

exportWorker.on("ready", () => {
  logger.info(`Worker ready for queue ${queueNames.exportDocx}`);
});

exportWorker.on("failed", (job, error) => {
  logger.error(`Job ${job?.id ?? "unknown"} failed`, error);
});
