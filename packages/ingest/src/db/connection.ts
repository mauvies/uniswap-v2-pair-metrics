import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Db = NodePgDatabase<Record<string, never>>;

/**
 * `max: 2` because pairs are processed one at a time; the second bounds the damage if that
 * stops being true. The timeout is there for the same reason the request one is: a one-shot
 * process must fail rather than hang on a database that is not there.
 */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5_000 });
}

export function createDb(pool: Pool): Db {
  return drizzle(pool);
}
