import {
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { DatabaseService } from '../infrastructure/database/database.service';
import { QueueService } from '../infrastructure/queue/queue.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { Public } from '../modules/auth/decorators/public.decorator';
import { MetricsService } from '../observability/metrics.service';

@Public()
@ApiExcludeController()
@Controller()
export class OpsController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('healthz')
  @HttpCode(200)
  healthz() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readyz')
  async readyz() {
    const checks = await Promise.all([
      this.databaseService.isReady(),
      this.queueService.isReady(),
      this.storageService.isReady(),
    ]);

    const [database, redis, storage] = checks;
    if (!database.ready || !redis.ready || !storage.ready) {
      throw new InternalServerErrorException({
        database,
        redis,
        storage,
      });
    }

    return {
      status: 'ready',
      checks: { database, redis, storage },
    };
  }

  @Get('metrics')
  async metrics(@Res() response: Response): Promise<void> {
    await this.queueService.recordQueueDepthMetrics();
    const metrics = await this.metricsService.getMetrics();
    response.setHeader('Content-Type', this.metricsService.contentType);
    response.status(200).send(metrics);
  }
}
