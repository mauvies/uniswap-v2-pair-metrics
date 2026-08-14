import { HOUR_SECONDS, PAIRS } from "@uniswap-v2-pair-metrics/shared";
import type { Pool } from "pg";
import { loadConfig } from "./config.ts";
import { createPool } from "./db/index.ts";
import { createGateway } from "./gateway/index.ts";
import type { LogLine } from "./log.ts";

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
 * A wall clock four hours past HOUR, and the upper bound it produces: the margin eats the
 * fourth hour, so the newest fetchable hour is HOUR + 2h and the window closes at HOUR + 3h.
 */
export const NOW = HOUR + 4 * HOUR_SECONDS;
export const CURRENT_HOUR = HOUR + 3 * HOUR_SECONDS;
export const BACKFILL_FROM = CURRENT_HOUR - 48 * HOUR_SECONDS;

/**
 * Ingest's own env validation, with the gateway key stubbed: these tests reach the database
 * but never the gateway, and `loadConfig` demands both.
 */
export function testPool(): Pool {
  return createPool(loadConfig({ ...process.env, THEGRAPH_API_KEY: "test" }).databaseUrl);
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
        "  docker compose up -d db\n" +
        "  pnpm db:migrate",
      { cause },
    );
  }
}

export interface WireHour {
  hourStartUnix: number;
  reserveUSD?: string;
  hourlyVolumeUSD?: string;
}

/** A subgraph row, in wire shape — `hourlyTxns` is still the string the gateway sends. */
export function wire({
  hourStartUnix,
  reserveUSD = "17689022.77",
  hourlyVolumeUSD = "1000",
}: WireHour) {
  return {
    hourStartUnix,
    reserve0: "17000000",
    reserve1: "5000",
    reserveUSD,
    hourlyVolumeToken0: "1000",
    hourlyVolumeToken1: "0.3",
    hourlyVolumeUSD,
    hourlyTxns: "12",
  };
}

export interface StubOptions {
  hoursByPair?: Record<string, ReturnType<typeof wire>[]>;
  meta?: { timestamp: number; hasIndexingErrors?: boolean } | "unavailable";
  failFor?: string;
}

export interface Stubbed {
  gateway: ReturnType<typeof createGateway>;
  windows: { pair: string; from: number; to: number }[];
  metaAttempts: () => number;
}

/**
 * The real gateway over a stub `fetch`, so the GraphQL documents, the envelope handling
 * and the zod boundary all run — only the network is replaced.
 */
export function stubGateway(options: StubOptions = {}): Stubbed {
  const windows: { pair: string; from: number; to: number }[] = [];
  let metaCalls = 0;

  const fetch: typeof globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables?: { pair: string; from: number; to: number };
    };

    if (body.query.includes("_meta")) {
      metaCalls += 1;

      if (options.meta === "unavailable") {
        return new Response("{}", { status: 503 });
      }

      const timestamp = typeof options.meta === "object" ? options.meta.timestamp : NOW;

      return new Response(
        JSON.stringify({
          data: {
            _meta: {
              block: { timestamp },
              hasIndexingErrors:
                typeof options.meta === "object" && (options.meta.hasIndexingErrors ?? false),
            },
          },
        }),
      );
    }

    const { pair, from, to } = body.variables ?? { pair: "", from: 0, to: 0 };
    windows.push({ pair, from, to });

    if (options.failFor === pair) {
      return new Response("{}", { status: 500 });
    }

    return new Response(
      JSON.stringify({ data: { pairHourDatas: options.hoursByPair?.[pair] ?? [] } }),
    );
  };

  return {
    gateway: createGateway({
      url: "https://example.test/api/KEY/subgraphs/id/X",
      fetch,
      sleep: async () => {},
    }),
    windows,
    metaAttempts: () => metaCalls,
  };
}

export function collectLogs(): { log: (line: LogLine) => void; lines: LogLine[] } {
  const lines: LogLine[] = [];

  return { log: (line) => void lines.push(line), lines };
}

/** The same row after the boundary has parsed it, for writing straight to the table. */
export function parsedHour(hourStartUnix: number) {
  return { ...wire({ hourStartUnix }), hourlyTxns: 12 };
}

/** `count` consecutive hours from the start of the default backfill window. */
export function consecutive(count: number, start = BACKFILL_FROM) {
  return Array.from({ length: count }, (_, i) => wire({ hourStartUnix: start + i * HOUR_SECONDS }));
}

export { HOUR_SECONDS };
