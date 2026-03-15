import { Queue } from 'bullmq';
import { buildBullConnection } from '../../src/infrastructure/queue/queue.connection';

type ReplayFlow = 'document' | 'translation' | 'video';

type ReplayArgs = {
  flow: ReplayFlow;
  limit: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): ReplayArgs {
  const args = new Map<string, string | boolean>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
      continue;
    }

    args.set(key, true);
  }

  const flowRaw = String(args.get('flow') ?? 'document');
  if (
    flowRaw !== 'document' &&
    flowRaw !== 'translation' &&
    flowRaw !== 'video'
  ) {
    throw new Error(
      'Invalid --flow value. Use "document", "translation", or "video".',
    );
  }

  const limitRaw = Number(args.get('limit') ?? 50);
  if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 1000) {
    throw new Error('Invalid --limit value. Use an integer between 1 and 1000.');
  }

  return {
    flow: flowRaw,
    limit: limitRaw,
    dryRun: Boolean(args.get('dry-run')),
  };
}

function resolveQueueNames(flow: ReplayFlow): {
  source: string;
  target: string;
  jobName: string;
} {
  if (flow === 'document') {
    return {
      source:
        process.env.DOCUMENT_PROCESS_DLQ_QUEUE_NAME ?? 'document.process.dlq',
      target:
        process.env.DOCUMENT_PROCESS_RETRY_QUEUE_NAME ??
        'document.process.retry',
      jobName: 'document.process.retry',
    };
  }

  if (flow === 'video') {
    return {
      source: process.env.VIDEO_GENERATE_DLQ_QUEUE_NAME ?? 'video.generate.dlq',
      target:
        process.env.VIDEO_GENERATE_RETRY_QUEUE_NAME ?? 'video.generate.retry',
      jobName: 'video.generate.retry',
    };
  }

  return {
    source:
      process.env.TRANSLATION_RETRY_DLQ_QUEUE_NAME ?? 'translation.retry.dlq',
    target:
      process.env.TRANSLATION_RETRY_RETRY_QUEUE_NAME ??
      'translation.retry.retry',
    jobName: 'translation.retry.retry',
  };
}

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required.');
  }

  const args = parseArgs(process.argv.slice(2));
  const names = resolveQueueNames(args.flow);
  const connection = buildBullConnection(redisUrl);

  const sourceQueue = new Queue(names.source, { connection });
  const targetQueue = new Queue(names.target, { connection });

  try {
    const jobs = await sourceQueue.getJobs(
      ['waiting', 'active', 'completed', 'failed', 'delayed'],
      0,
      args.limit - 1,
      true,
    );

    if (jobs.length === 0) {
      console.log(`No jobs found in source queue ${names.source}.`);
      return;
    }

    if (args.dryRun) {
      console.log(
        `[dry-run] Found ${jobs.length} jobs in ${names.source}. No jobs were enqueued.`,
      );
      return;
    }

    let replayed = 0;
    for (const job of jobs) {
      await targetQueue.add(names.jobName, job.data);
      replayed += 1;
    }

    console.log(
      `Replayed ${replayed} jobs from ${names.source} to ${names.target}.`,
    );
  } finally {
    await sourceQueue.close();
    await targetQueue.close();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`DLQ replay failed: ${message}`);
  process.exitCode = 1;
});
