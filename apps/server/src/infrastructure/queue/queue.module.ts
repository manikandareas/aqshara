import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CONNECTION } from './queue.constants';
import { QueueService } from './queue.service';
import { RedisStreamsService } from './redis-streams.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis(configService.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: null,
          lazyConnect: true,
        });
      },
    },
    QueueService,
    RedisStreamsService,
  ],
  exports: [REDIS_CONNECTION, QueueService, RedisStreamsService],
})
export class QueueModule {}
