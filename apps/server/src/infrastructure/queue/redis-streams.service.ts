import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CONNECTION } from './queue.constants';

export type RedisStreamEntry = {
  id: string;
  values: Record<string, string>;
};

@Injectable()
export class RedisStreamsService {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: Redis) {}

  async ensureConsumerGroup(stream: string, group: string): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
    } catch (error) {
      const message = (error as Error).message;
      if (!message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  async publishJson(stream: string, payload: object): Promise<string> {
    const streamId = await this.redis.xadd(
      stream,
      '*',
      'payload',
      JSON.stringify(payload),
    );

    if (!streamId) {
      throw new Error(`Failed to publish Redis stream payload to ${stream}`);
    }

    return streamId;
  }

  async readGroup(
    stream: string,
    group: string,
    consumer: string,
    count: number,
    blockMs: number,
  ): Promise<RedisStreamEntry[]> {
    const response = (await this.redis.xreadgroup(
      'GROUP',
      group,
      consumer,
      'COUNT',
      count,
      'BLOCK',
      blockMs,
      'STREAMS',
      stream,
      '>',
    )) as Array<[string, Array<[string, string[]]>]> | null;

    if (!response?.length) {
      return [];
    }

    const [, entries] = response[0]!;

    return entries.map(([id, rawValues]) => ({
      id,
      values: this.toRecord(rawValues),
    }));
  }

  async acknowledge(stream: string, group: string, id: string): Promise<void> {
    await this.redis.xack(stream, group, id);
  }

  private toRecord(rawValues: string[]): Record<string, string> {
    const values: Record<string, string> = {};

    for (let index = 0; index < rawValues.length; index += 2) {
      const key = rawValues[index];
      const value = rawValues[index + 1];

      if (key && value !== undefined) {
        values[key] = value;
      }
    }

    return values;
  }
}
