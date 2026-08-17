import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Reached through the `./db` subpath, never the barrel. §3 says why this boundary is the
// harder of the two.

export type Db = NodePgDatabase<Record<string, never>>;

/**
 * `connectionTimeoutMillis` overrides pg's default infinite wait:
 * a process unable to reach the database must fail fast, not hang.
 *
 * `max` is configured by the caller based on its concurrency needs:
 * ingest processes one pair at a time, whereas the API serves concurrent
 * requests using pg's default pool size of 10.
 */
export function createPool(connectionString: string, options: { max?: number } = {}): Pool {
  return new Pool({ connectionString, connectionTimeoutMillis: 5_000, ...options });
}

export function createDb(pool: Pool): Db {
  return drizzle(pool);
}
