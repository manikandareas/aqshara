import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestDurationMs: Histogram<string>;
  private readonly queueJobsTotal: Counter<string>;
  private readonly queueJobsDepth: Gauge<string>;
  private readonly videoJobCallbacksTotal: Counter<string>;
  private readonly videoJobFallbacksTotal: Counter<string>;
  private readonly videoJobStageElapsedMs: Histogram<string>;
  private readonly videoJobSceneEventsTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestDurationMs = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000],
      registers: [this.registry],
    });

    this.queueJobsTotal = new Counter({
      name: 'queue_jobs_total',
      help: 'Total queue jobs by queue and status',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.queueJobsDepth = new Gauge({
      name: 'queue_jobs_depth',
      help: 'Current queue depth by queue and status bucket',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.videoJobCallbacksTotal = new Counter({
      name: 'video_job_callbacks_total',
      help: 'Total internal video job callbacks by action and stage',
      labelNames: ['action', 'stage'],
      registers: [this.registry],
    });

    this.videoJobFallbacksTotal = new Counter({
      name: 'video_job_fallbacks_total',
      help: 'Total video job fallback events by stage and reason',
      labelNames: ['stage', 'reason'],
      registers: [this.registry],
    });

    this.videoJobStageElapsedMs = new Histogram({
      name: 'video_job_stage_elapsed_ms',
      help: 'Observed video job elapsed time snapshots by stage',
      labelNames: ['stage'],
      buckets: [10, 50, 100, 250, 500, 1000, 5000, 15000, 30000, 60000, 180000],
      registers: [this.registry],
    });

    this.videoJobSceneEventsTotal = new Counter({
      name: 'video_job_scene_events_total',
      help: 'Total video job scene progress events by stage, scene status, and template',
      labelNames: ['stage', 'scene_status', 'template_type'],
      registers: [this.registry],
    });
  }

  observeHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    this.httpRequestDurationMs
      .labels(method, route, String(statusCode))
      .observe(durationMs);
  }

  incrementQueueJob(queueName: string, status: string): void {
    this.queueJobsTotal.labels(queueName, status).inc();
  }

  setQueueDepth(queueName: string, status: string, depth: number): void {
    this.queueJobsDepth.labels(queueName, status).set(depth);
  }

  recordVideoJobCallback(action: string, stage: string): void {
    this.videoJobCallbacksTotal.labels(action, stage).inc();
  }

  recordVideoJobFallback(stage: string, reason: string): void {
    this.videoJobFallbacksTotal.labels(stage, reason).inc();
  }

  observeVideoJobStageElapsed(stage: string, elapsedMs: number): void {
    this.videoJobStageElapsedMs.labels(stage).observe(elapsedMs);
  }

  recordVideoJobSceneEvent(
    stage: string,
    sceneStatus: string,
    templateType: string,
  ): void {
    this.videoJobSceneEventsTotal
      .labels(stage, sceneStatus, templateType)
      .inc();
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
