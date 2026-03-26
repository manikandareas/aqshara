import { Queue, type JobsOptions } from "bullmq";
import { getRedisConnection } from "@aqshara/config";
import {
  exportDocxJobName,
  queueNames,
  type ExportDocxPayload,
} from "@aqshara/queue";

let exportQueue: Queue<ExportDocxPayload> | undefined;

function getExportDocxQueue(): Queue<ExportDocxPayload> {
  if (!exportQueue) {
    exportQueue = new Queue<ExportDocxPayload>(queueNames.exportDocx, {
      connection: getRedisConnection(),
    });
  }
  return exportQueue;
}

export function getExportQueueJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  };
}

export async function enqueueExportDocxJob(
  payload: ExportDocxPayload,
): Promise<{ jobId: string }> {
  const queue = getExportDocxQueue();
  const job = await queue.add(
    exportDocxJobName,
    payload,
    getExportQueueJobOptions(),
  );
  return { jobId: String(job.id ?? "") };
}
