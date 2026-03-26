import { Queue, type JobsOptions } from "bullmq";
import { getRedisConnection } from "@aqshara/config";
import {
  parseSourceJobName,
  queueNames,
  type ParseSourcePayload,
} from "@aqshara/queue";

let parseSourceQueue: Queue<ParseSourcePayload> | undefined;

function getParseSourceQueue(): Queue<ParseSourcePayload> {
  if (!parseSourceQueue) {
    parseSourceQueue = new Queue<ParseSourcePayload>(queueNames.parseSource, {
      connection: getRedisConnection(),
    });
  }
  return parseSourceQueue;
}

export function getParseSourceQueueJobOptions(): JobsOptions {
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

export async function enqueueParseSourceJob(
  payload: ParseSourcePayload,
): Promise<{ jobId: string }> {
  const queue = getParseSourceQueue();
  const job = await queue.add(
    parseSourceJobName,
    payload,
    getParseSourceQueueJobOptions(),
  );
  return { jobId: String(job.id ?? "") };
}
