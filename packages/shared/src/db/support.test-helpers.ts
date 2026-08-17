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

/**
 * Not read from `POSTGRES_DB`: a filtered `pnpm --filter … test` inherits nothing
 * from `scripts/test.sh`, which reads the name from here to create and migrate it.
 */
export const TEST_DATABASE = "uniswap_v2_pair_metrics_test";

export function testPool(): Pool {
  return createPool(
    databaseUrl({ ...process.env, DATABASE_URL: undefined, POSTGRES_DB: TEST_DATABASE }),
  );
}

export async function assertReachable(pool: Pool): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();
  } catch (cause) {
    throw new Error(
      `cannot reach ${TEST_DATABASE}. One command starts Postgres, creates it and applies\n` +
        "the schema; after it has run once, filtered test commands work on their own:\n" +
        "  pnpm test",
      { cause },
    );
  }
}
