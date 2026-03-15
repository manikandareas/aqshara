import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CONNECTION } from '../../infrastructure/queue/queue.constants';
import type {
  VideoGenerateCommand,
  VideoTransportEvent,
} from './video-transport.schemas';
import { parseVideoTransportEvent } from './video-transport.schemas';

type RedisStreamResponse = Array<[string, Array<[string, string[]]>]>;

@Injectable()
export class VideoTransportService {
  private readonly logger = new Logger(VideoTransportService.name);
  private readonly commandStreamName: string;
  private readonly eventStreamName: string;
  private readonly eventConsumerGroup: string;
  private readonly eventConsumerName: string;
  private readonly streamBatchSize: number;
  private readonly streamBlockMs: number;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.commandStreamName = this.getConfig(
      'VIDEO_COMMAND_STREAM_NAME',
      'video.job.commands',
    );
    this.eventStreamName = this.getConfig(
      'VIDEO_EVENT_STREAM_NAME',
      'video.job.events',
    );
    this.eventConsumerGroup = this.getConfig(
      'VIDEO_EVENT_CONSUMER_GROUP',
      'video-api',
    );
    this.eventConsumerName = this.getConfig(
      'VIDEO_EVENT_CONSUMER_NAME',
      `video-api-${randomUUID().slice(0, 8)}`,
    );
    this.streamBatchSize = this.getConfig('VIDEO_STREAM_BATCH_SIZE', 20);
    this.streamBlockMs = this.getConfig('VIDEO_STREAM_BLOCK_MS', 5000);
  }

  get commandStream(): string {
    return this.commandStreamName;
  }

  get eventStream(): string {
    return this.eventStreamName;
  }

  async publishCommand(command: VideoGenerateCommand): Promise<string> {
    const streamId = await this.redis.xadd(
      this.commandStreamName,
      '*',
      'payload',
      JSON.stringify(command),
    );

    if (!streamId) {
      throw new Error(
        `Failed to publish video command to stream ${this.commandStreamName}`,
      );
    }

    return streamId;
  }

  async ensureEventConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.eventStreamName,
        this.eventConsumerGroup,
        '0',
        'MKSTREAM',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  async consumeEvents(
    handler: (event: VideoTransportEvent, streamId: string) => Promise<void>,
  ): Promise<void> {
    await this.ensureEventConsumerGroup();

    const response = (await this.redis.xreadgroup(
      'GROUP',
      this.eventConsumerGroup,
      this.eventConsumerName,
      'COUNT',
      this.streamBatchSize,
      'BLOCK',
      this.streamBlockMs,
      'STREAMS',
      this.eventStreamName,
      '>',
    )) as RedisStreamResponse | null;

    if (!response) {
      return;
    }

    for (const [, entries] of response) {
      for (const [streamId, fields] of entries) {
        await this.processEventEntry(fields, streamId, handler);
      }
    }
  }

  private getConfig<T>(key: string, fallback: T): T {
    return this.configService.get<T>(key, fallback);
  }

  private async processEventEntry(
    fields: string[],
    streamId: string,
    handler: (event: VideoTransportEvent, streamId: string) => Promise<void>,
  ): Promise<void> {
    try {
      const event = parseVideoTransportEvent(
        JSON.parse(this.extractPayload(fields)),
      );
      await handler(event, streamId);
      await this.redis.xack(
        this.eventStreamName,
        this.eventConsumerGroup,
        streamId,
      );
    } catch (error) {
      this.logger.error({
        message: 'Failed to process video transport event',
        stream_id: streamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private extractPayload(fields: string[]): string {
    for (let index = 0; index < fields.length; index += 2) {
      if (fields[index] === 'payload') {
        return fields[index + 1] ?? '{}';
      }
    }

    throw new Error('Missing payload field in stream message');
  }
}
