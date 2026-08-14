import type { Pool } from "pg";
import { PAIRS } from "../pairs.ts";
import { createPool } from "./connection.ts";
import { databaseUrl } from "./database-url.ts";

/** By symbol rather than by index: a reordered PAIRS must not silently retarget a test. */
function addressOf(symbols: string): string {
  const pair = PAIRS.find((p) => `${p.token0Symbol}/${p.token1Symbol}` === symbols);

  if (pair === undefined) {
    throw new Error(`${symbols} is not in PAIRS`);
  }

  return pair.address;
}

export const ACTIVE = addressOf("USDC/WETH");
export const DEAD = addressOf("WETH/RKFL");

/** 2026-08-12 09:00:00 UTC, hour-aligned. */
export const HOUR = 1_786_525_200;

/** Straight off `databaseUrl`, not a service's `loadConfig` — a db test needs no gateway key. */
export function testPool(): Pool {
  return createPool(databaseUrl(process.env));
}

/**
 * The driver's own failure is `Failed query: delete from "pair_hour_metrics"`, which says
 * nothing about the database being down or how to start it.
 */
export async function assertReachable(pool: Pool): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();
  } catch (cause) {
    throw new Error(
      "cannot reach the database these tests need. Start it and apply the schema:\n" +
        "  pnpm db:migrate",
      { cause },
    );
  }
}
