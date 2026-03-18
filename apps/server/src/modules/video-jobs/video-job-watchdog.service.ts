import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoJobsService } from './video-jobs.service';

@Injectable()
export class VideoJobWatchdogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoJobWatchdogService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly videoJobsService: VideoJobsService,
  ) {}

  onModuleInit(): void {
    if (!this.isWorkerRuntime()) {
      return;
    }

    const pollMs = this.configService.get<number>(
      'VIDEO_WATCHDOG_POLL_MS',
      15_000,
    );
    this.timer = setInterval(() => {
      void this.runOnce();
    }, pollMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async runOnce(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const recovered = await this.videoJobsService.recoverStalledJobs();
      if (recovered > 0) {
        this.logger.warn({
          message: 'Recovered stalled video jobs',
          count: recovered,
          lease_ttl_ms: this.configService.get<number>(
            'VIDEO_WORKER_LEASE_TTL_MS',
            45_000,
          ),
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Video job watchdog failed',
        error: (error as Error).message,
      });
    } finally {
      this.running = false;
    }
  }

  private isWorkerRuntime(): boolean {
    return process.env.AQSHARA_RUNTIME_ROLE === 'worker';
  }
}
