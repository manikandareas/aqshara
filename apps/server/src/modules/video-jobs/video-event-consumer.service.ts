import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { VideoTransportService } from './video-transport.service';
import { VideoJobsService } from './video-jobs.service';

@Injectable()
export class VideoEventConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoEventConsumerService.name);
  private stopped = false;

  constructor(
    private readonly videoTransportService: VideoTransportService,
    private readonly videoJobsService: VideoJobsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isWorkerRuntime()) {
      return;
    }

    void this.consumeLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
  }

  private async consumeLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.videoTransportService.consumeEvents(async (event) => {
          await this.videoJobsService.ingestTransportEvent(event);
        });
      } catch (error) {
        this.logger.error({
          message: 'Video event consumer loop failed',
          error: (error as Error).message,
        });
      }
    }
  }

  private isWorkerRuntime(): boolean {
    return process.env.AQSHARA_RUNTIME_ROLE === 'worker';
  }
}
