import type { ConnectionOptions } from 'bullmq';

export function buildBullConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const dbFromPath = url.pathname
    ? Number(url.pathname.replace('/', ''))
    : undefined;

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number.isFinite(dbFromPath) ? dbFromPath : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}
