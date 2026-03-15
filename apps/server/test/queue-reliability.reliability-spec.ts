import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { QueueService } from '../src/infrastructure/queue/queue.service';
import { buildBullConnection } from '../src/infrastructure/queue/queue.connection';
import { PipelineDocumentProcessorService } from '../src/modules/pipeline/pipeline-document-processor.service';
import { PipelineJobRoutingService } from '../src/modules/pipeline/pipeline-job-routing.service';
import { PipelineTranslationRetryProcessorService } from '../src/modules/pipeline/pipeline-translation-retry-processor.service';
import { PipelineWorkerService } from '../src/modules/pipeline/pipeline.worker.service';
import { VideoJobProcessorService } from '../src/modules/video-jobs/video-job-processor.service';
import { VideoJobRoutingService } from '../src/modules/video-jobs/video-job-routing.service';
import { MetricsService } from '../src/observability/metrics.service';

type Runtime = {
  queueService: QueueService;
  workerService: PipelineWorkerService;
  metricsService: MetricsService;
  inspectors: {
    documentProcess: Queue;
    documentProcessRetry: Queue;
    documentProcessDlq: Queue;
    translationRetry: Queue;
    translationRetryRetry: Queue;
    translationRetryDlq: Queue;
    videoGenerate: Queue;
    videoGenerateRetry: Queue;
    videoGenerateDlq: Queue;
  };
  names: {
    documentProcess: string;
    documentProcessRetry: string;
    documentProcessDlq: string;
    translationRetry: string;
    translationRetryRetry: string;
    translationRetryDlq: string;
    videoGenerate: string;
    videoGenerateRetry: string;
    videoGenerateDlq: string;
  };
};

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => Promise<boolean> | boolean,
  timeoutMs = 10000,
  intervalMs = 50,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await sleep(intervalMs);
  }

  throw new Error('Timed out waiting for condition');
}

function createRuntime(): {
  runtime: Runtime;
  documentProcessorMocks: {
    process: jest.Mock;
    processDlq: jest.Mock;
  };
  translationProcessorMocks: {
    process: jest.Mock;
    processDlq: jest.Mock;
  };
  videoProcessorMocks: {
    process: jest.Mock;
    processDlq: jest.Mock;
  };
} {
  const suffix = randomUUID();
  const names = {
    documentProcess: `test.document.process.${suffix}`,
    documentProcessRetry: `test.document.process.retry.${suffix}`,
    documentProcessDlq: `test.document.process.dlq.${suffix}`,
    translationRetry: `test.translation.retry.${suffix}`,
    translationRetryRetry: `test.translation.retry.retry.${suffix}`,
    translationRetryDlq: `test.translation.retry.dlq.${suffix}`,
    videoGenerate: `test.video.generate.${suffix}`,
    videoGenerateRetry: `test.video.generate.retry.${suffix}`,
    videoGenerateDlq: `test.video.generate.dlq.${suffix}`,
  };

  const configValues: Record<string, string | boolean> = {
    REDIS_URL,
    QUEUE_DISABLED: false,
    DOCUMENT_PROCESS_QUEUE_NAME: names.documentProcess,
    DOCUMENT_PROCESS_RETRY_QUEUE_NAME: names.documentProcessRetry,
    DOCUMENT_PROCESS_DLQ_QUEUE_NAME: names.documentProcessDlq,
    TRANSLATION_RETRY_QUEUE_NAME: names.translationRetry,
    TRANSLATION_RETRY_RETRY_QUEUE_NAME: names.translationRetryRetry,
    TRANSLATION_RETRY_DLQ_QUEUE_NAME: names.translationRetryDlq,
    VIDEO_GENERATE_QUEUE_NAME: names.videoGenerate,
    VIDEO_GENERATE_RETRY_QUEUE_NAME: names.videoGenerateRetry,
    VIDEO_GENERATE_DLQ_QUEUE_NAME: names.videoGenerateDlq,
  };

  const configService = {
    get<T>(key: string, defaultValue?: T): T {
      const value = configValues[key];
      return (value !== undefined ? value : defaultValue) as T;
    },
    getOrThrow<T>(key: string): T {
      const value = configValues[key];
      if (value === undefined) {
        throw new Error(`Missing config key: ${key}`);
      }

      return value as T;
    },
  } as unknown as ConfigService;

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  const metricsService = new MetricsService();
  const queueService = new QueueService(redis, configService, metricsService);

  const documentProcessorMocks = {
    process: jest.fn(),
    processDlq: jest.fn(),
  };
  const translationProcessorMocks = {
    process: jest.fn(),
    processDlq: jest.fn(),
  };
  const videoProcessorMocks = {
    process: jest.fn(),
    processDlq: jest.fn(),
  };

  const workerService = new PipelineWorkerService(
    configService,
    queueService,
    metricsService,
    new PipelineJobRoutingService(queueService, metricsService),
    documentProcessorMocks as unknown as PipelineDocumentProcessorService,
    translationProcessorMocks as unknown as PipelineTranslationRetryProcessorService,
    new VideoJobRoutingService(queueService),
    videoProcessorMocks as unknown as VideoJobProcessorService,
  );

  workerService.onModuleInit();

  const connection = buildBullConnection(REDIS_URL);
  const inspectors = {
    documentProcess: new Queue(names.documentProcess, { connection }),
    documentProcessRetry: new Queue(names.documentProcessRetry, { connection }),
    documentProcessDlq: new Queue(names.documentProcessDlq, { connection }),
    translationRetry: new Queue(names.translationRetry, { connection }),
    translationRetryRetry: new Queue(names.translationRetryRetry, {
      connection,
    }),
    translationRetryDlq: new Queue(names.translationRetryDlq, { connection }),
    videoGenerate: new Queue(names.videoGenerate, { connection }),
    videoGenerateRetry: new Queue(names.videoGenerateRetry, { connection }),
    videoGenerateDlq: new Queue(names.videoGenerateDlq, { connection }),
  };

  return {
    runtime: {
      queueService,
      workerService,
      metricsService,
      inspectors,
      names,
    },
    documentProcessorMocks,
    translationProcessorMocks,
    videoProcessorMocks,
  };
}

async function destroyRuntime(runtime: Runtime): Promise<void> {
  await runtime.workerService.onModuleDestroy();

  for (const queue of Object.values(runtime.inspectors)) {
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
  }

  await runtime.queueService.onModuleDestroy();
}

describe('Queue reliability integration (Redis + BullMQ)', () => {
  let runtime: Runtime | null = null;

  afterEach(async () => {
    if (runtime) {
      await destroyRuntime(runtime);
      runtime = null;
    }
  });

  it('routes document flow success without retry or DLQ', async () => {
    const created = createRuntime();
    runtime = created.runtime;
    created.documentProcessorMocks.process.mockResolvedValue(undefined);

    await runtime.queueService.enqueueDocumentProcess({
      document_id: 'doc_1',
      actor_id: 'user_1',
      require_translate: true,
      request_id: 'req_doc_success',
    });

    await waitFor(
      () => created.documentProcessorMocks.process.mock.calls.length === 1,
    );

    const retryCounts =
      await runtime.inspectors.documentProcessRetry.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
      );
    const dlqCounts = await runtime.inspectors.documentProcessDlq.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
    );

    expect(Object.values(retryCounts).reduce((a, b) => a + b, 0)).toBe(0);
    expect(Object.values(dlqCounts).reduce((a, b) => a + b, 0)).toBe(0);

    await runtime.queueService.recordQueueDepthMetrics();
    const metrics = await runtime.metricsService.getMetrics();
    expect(metrics).toContain('queue_jobs_depth');
    expect(metrics).toContain(runtime.names.documentProcess);
  });

  it('routes document failures through retry then DLQ', async () => {
    const created = createRuntime();
    runtime = created.runtime;

    created.documentProcessorMocks.process.mockRejectedValue(
      new Error('doc processor failed'),
    );
    created.documentProcessorMocks.processDlq.mockResolvedValue(undefined);

    await runtime.queueService.enqueueDocumentProcess({
      document_id: 'doc_2',
      actor_id: 'user_2',
      require_translate: false,
      request_id: 'req_doc_dlq',
    });

    await waitFor(
      () => created.documentProcessorMocks.processDlq.mock.calls.length === 1,
    );

    expect(
      created.documentProcessorMocks.process.mock.calls.length,
    ).toBeGreaterThanOrEqual(2);

    const metrics = await runtime.metricsService.getMetrics();
    expect(metrics).toContain(
      `queue="${runtime.names.documentProcessRetry}",status="enqueued"`,
    );
    expect(metrics).toContain(
      `queue="${runtime.names.documentProcessDlq}",status="enqueued"`,
    );
  });

  it('routes translation flow success without retry or DLQ', async () => {
    const created = createRuntime();
    runtime = created.runtime;

    created.translationProcessorMocks.process.mockResolvedValue(undefined);

    await runtime.queueService.enqueueTranslationRetry({
      document_id: 'doc_3',
      paragraph_id: 'p_3',
      actor_id: 'user_3',
      request_id: 'req_translation_success',
    });

    await waitFor(
      () => created.translationProcessorMocks.process.mock.calls.length === 1,
    );

    const retryCounts =
      await runtime.inspectors.translationRetryRetry.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
      );
    const dlqCounts = await runtime.inspectors.translationRetryDlq.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
    );

    expect(Object.values(retryCounts).reduce((a, b) => a + b, 0)).toBe(0);
    expect(Object.values(dlqCounts).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('routes translation failures through retry then DLQ', async () => {
    const created = createRuntime();
    runtime = created.runtime;

    created.translationProcessorMocks.process.mockRejectedValue(
      new Error('translation processor failed'),
    );
    created.translationProcessorMocks.processDlq.mockResolvedValue(undefined);

    await runtime.queueService.enqueueTranslationRetry({
      document_id: 'doc_4',
      paragraph_id: 'p_4',
      actor_id: 'user_4',
      request_id: 'req_translation_dlq',
    });

    await waitFor(
      () =>
        created.translationProcessorMocks.processDlq.mock.calls.length === 1,
    );

    expect(
      created.translationProcessorMocks.process.mock.calls.length,
    ).toBeGreaterThanOrEqual(2);

    const metrics = await runtime.metricsService.getMetrics();
    expect(metrics).toContain(
      `queue="${runtime.names.translationRetryRetry}",status="enqueued"`,
    );
    expect(metrics).toContain(
      `queue="${runtime.names.translationRetryDlq}",status="enqueued"`,
    );
  });

  it('routes video generation success without retry or DLQ', async () => {
    const created = createRuntime();
    runtime = created.runtime;

    created.videoProcessorMocks.process.mockResolvedValue(undefined);

    await runtime.queueService.enqueueVideoGenerate({
      video_job_id: 'vjob_1',
      document_id: 'doc_video_success',
      actor_id: 'user_video',
      request_id: 'req_video_success',
      attempt: 1,
    });

    await waitFor(
      () => created.videoProcessorMocks.process.mock.calls.length === 1,
    );

    const retryCounts =
      await runtime.inspectors.videoGenerateRetry.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
      );
    const dlqCounts = await runtime.inspectors.videoGenerateDlq.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
    );

    expect(Object.values(retryCounts).reduce((a, b) => a + b, 0)).toBe(0);
    expect(Object.values(dlqCounts).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('routes video generation failures through retry then DLQ', async () => {
    const created = createRuntime();
    runtime = created.runtime;

    created.videoProcessorMocks.process.mockRejectedValue(
      new Error('video processor failed'),
    );
    created.videoProcessorMocks.processDlq.mockResolvedValue(undefined);

    await runtime.queueService.enqueueVideoGenerate({
      video_job_id: 'vjob_2',
      document_id: 'doc_video_dlq',
      actor_id: 'user_video',
      request_id: 'req_video_dlq',
      attempt: 1,
    });

    await waitFor(
      () => created.videoProcessorMocks.processDlq.mock.calls.length === 1,
    );

    expect(
      created.videoProcessorMocks.process.mock.calls.length,
    ).toBeGreaterThanOrEqual(2);

    const metrics = await runtime.metricsService.getMetrics();
    expect(metrics).toContain(
      `queue="${runtime.names.videoGenerateRetry}",status="enqueued"`,
    );
    expect(metrics).toContain(
      `queue="${runtime.names.videoGenerateDlq}",status="enqueued"`,
    );
  });
});
