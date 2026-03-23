import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "@aqshara/config";
export * from "./schema.js";

let pool: Pool | undefined;

export function createDatabase() {
  return drizzle({
    client: new Pool({
      connectionString: getDatabaseUrl(),
    }),
  });
}

export function getDatabase() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return drizzle({
    client: pool,
  });
}
