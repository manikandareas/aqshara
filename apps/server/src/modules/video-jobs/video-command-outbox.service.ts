import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisStreamsService } from '../../infrastructure/queue/redis-streams.service';
import { VideoJobsRepository } from './video-jobs.repository';

@Injectable()
export class VideoCommandOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoCommandOutboxService.name);
  private timer?: NodeJS.Timeout;
  private flushing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly videoJobsRepository: VideoJobsRepository,
    private readonly redisStreamsService: RedisStreamsService,
  ) {}

  onModuleInit(): void {
    if (!this.isWorkerRuntime()) {
      return;
    }

    const pollMs = this.configService.get<number>('VIDEO_OUTBOX_POLL_MS', 1000);
    this.timer = setInterval(() => {
      void this.flushOnce();
    }, pollMs);
    void this.flushOnce();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async flushOnce(): Promise<void> {
    if (this.flushing) {
      return;
    }

    this.flushing = true;

    try {
      const streamName = this.configService.get<string>(
        'VIDEO_COMMAND_STREAM_NAME',
        'video.job.commands',
      );
      const batchSize = this.configService.get<number>(
        'VIDEO_STREAM_BATCH_SIZE',
        20,
      );
      const pending = await this.videoJobsRepository.claimPendingOutbox(batchSize);

      for (const outbox of pending) {
        try {
          await this.redisStreamsService.publishJson(streamName, outbox.payload);
          await this.videoJobsRepository.markOutboxPublished(outbox.id);
        } catch (error) {
          const message = (error as Error).message;
          this.logger.error({
            message: 'Failed to publish video transport command',
            outbox_id: outbox.id,
            video_job_id: outbox.video_job_id,
            error: message,
          });
          await this.videoJobsRepository.markOutboxFailed(
            outbox.id,
            message,
            new Date(Date.now() + 15_000),
          );
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private isWorkerRuntime(): boolean {
    return process.env.AQSHARA_RUNTIME_ROLE === 'worker';
  }
}
