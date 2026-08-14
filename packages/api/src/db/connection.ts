import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Db = NodePgDatabase<Record<string, never>>;

/**
 * The pool default of 10 stands, unlike ingest's `max: 2`: this process serves concurrent
 * requests rather than one pair at a time. The connection timeout is ingest's, for the same
 * reason — a request must fail rather than hang on a database that is not there.
 */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, connectionTimeoutMillis: 5_000 });
}

export function createDb(pool: Pool): Db {
  return drizzle(pool);
}
