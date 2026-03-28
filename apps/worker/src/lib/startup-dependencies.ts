import { getRedisClient } from "@aqshara/config";
import { createDatabase } from "@aqshara/database";
import { sql } from "drizzle-orm";

type StartupRedisClient = {
  status?: string;
  connect: () => Promise<unknown>;
  ping: () => Promise<unknown>;
};

type StartupDatabase = {
  execute: (query: any) => any;
};

type StartupValidationDeps = {
  createDatabase: () => StartupDatabase;
  getRedisClient: () => StartupRedisClient;
};

export async function validateStartupDependencies(
  deps: StartupValidationDeps = {
    createDatabase,
    getRedisClient,
  },
): Promise<void> {
  const db = deps.createDatabase();
  const redis = deps.getRedisClient();

  if (redis.status === "wait") {
    await redis.connect();
  }

  await Promise.all([redis.ping(), db.execute(sql`select 1`)]);
}
