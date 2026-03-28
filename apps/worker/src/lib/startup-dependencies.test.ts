import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateStartupDependencies } from "./startup-dependencies.js";

describe("validateStartupDependencies", () => {
  it("connects redis before pinging when the client is lazy", async () => {
    const calls: string[] = [];

    await validateStartupDependencies({
      createDatabase: () => ({
        execute: async () => {
          calls.push("db.execute");
        },
      }),
      getRedisClient: () => ({
        status: "wait",
        connect: async () => {
          calls.push("redis.connect");
        },
        ping: async () => {
          calls.push("redis.ping");
        },
      }),
    });

    assert.ok(
      calls.indexOf("redis.connect") !== -1 &&
        calls.indexOf("redis.ping") !== -1 &&
        calls.indexOf("redis.connect") < calls.indexOf("redis.ping"),
      `expected redis.connect before redis.ping, got ${calls.join(", ")}`,
    );
    assert.ok(calls.includes("db.execute"));
  });
});
