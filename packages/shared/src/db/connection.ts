import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Reached through the `./db` subpath, never the barrel (§3). A re-export would not fatten
// the web bundle the way the schema did: `pg` does not bundle for a browser at all.

export type Db = NodePgDatabase<Record<string, never>>;

/**
 * `connectionTimeoutMillis` replaces pg's default of waiting indefinitely: a process that
 * cannot reach the database must fail rather than hang.
 *
 * `max` belongs to the caller, because the right size is a property of the caller and not
 * of the database — ingest processes one pair at a time, the API serves concurrent requests
 * on pg's default of 10.
 */
export function createPool(connectionString: string, options: { max?: number } = {}): Pool {
  return new Pool({ connectionString, connectionTimeoutMillis: 5_000, ...options });
}

export function createDb(pool: Pool): Db {
  return drizzle(pool);
}
