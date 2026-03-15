import { Queue } from 'bullmq';
import { buildBullConnection } from '../../src/infrastructure/queue/queue.connection';

type ClearQueueArgs = {
  dryRun: boolean;
};

function parseArgs(argv: string[]): ClearQueueArgs {
  const args = new Set(argv);
  return {
    dryRun: args.has('--dry-run'),
  };
}

function resolveQueueNames(): string[] {
  return [
    process.env.DOCUMENT_PROCESS_QUEUE_NAME ?? 'document.process',
    process.env.DOCUMENT_PROCESS_RETRY_QUEUE_NAME ?? 'document.process.retry',
    process.env.DOCUMENT_PROCESS_DLQ_QUEUE_NAME ?? 'document.process.dlq',
    process.env.TRANSLATION_RETRY_QUEUE_NAME ?? 'translation.retry',
    process.env.TRANSLATION_RETRY_RETRY_QUEUE_NAME ?? 'translation.retry.retry',
    process.env.TRANSLATION_RETRY_DLQ_QUEUE_NAME ?? 'translation.retry.dlq',
    process.env.VIDEO_GENERATE_QUEUE_NAME ?? 'video.generate',
    process.env.VIDEO_GENERATE_RETRY_QUEUE_NAME ?? 'video.generate.retry',
    process.env.VIDEO_GENERATE_DLQ_QUEUE_NAME ?? 'video.generate.dlq',
  ];
}

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required.');
  }

  const args = parseArgs(process.argv.slice(2));
  const queueNames = resolveQueueNames();
  const connection = buildBullConnection(redisUrl);

  const queues = queueNames.map((name) => new Queue(name, { connection }));

  try {
    if (args.dryRun) {
      console.log(`[dry-run] Queue targets: ${queueNames.join(', ')}`);
      return;
    }

    for (const queue of queues) {
      await queue.obliterate({ force: true });
      console.log(`Cleared queue: ${queue.name}`);
    }

    console.log(`Cleared ${queues.length} queues.`);
  } finally {
    await Promise.all(queues.map((queue) => queue.close()));
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Queue clear failed: ${message}`);
  process.exitCode = 1;
});
