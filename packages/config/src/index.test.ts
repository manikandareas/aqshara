import assert from "node:assert/strict";
import test from "node:test";
import { getRedisConnection } from "./index.ts";

test("getRedisConnection reads process env at call time", () => {
  const originalHost = process.env.REDIS_HOST;
  const originalPort = process.env.REDIS_PORT;

  process.env.REDIS_HOST = "redis.internal";
  process.env.REDIS_PORT = "6380";

  try {
    const connection = getRedisConnection();
    assert.equal(connection.host, "redis.internal");
    assert.equal(connection.port, 6380);
  } finally {
    if (originalHost === undefined) {
      delete process.env.REDIS_HOST;
    } else {
      process.env.REDIS_HOST = originalHost;
    }

    if (originalPort === undefined) {
      delete process.env.REDIS_PORT;
    } else {
      process.env.REDIS_PORT = originalPort;
    }
  }
});
