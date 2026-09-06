import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { HOUR } from "@uniswap-v2-pair-metrics/shared/test-helpers";
import { createGateway } from "./gateway/index.ts";
import type { LogLine } from "./log.ts";

/**
 * A wall clock four hours past HOUR. The margin eats the fourth hour, so the window ends at
 * HOUR + 3h and the newest fetchable hour is HOUR + 2h.
 */
export const NOW = HOUR + 4 * HOUR_SECONDS;
export const CURRENT_HOUR = HOUR + 3 * HOUR_SECONDS;
export const BACKFILL_FROM = CURRENT_HOUR - 48 * HOUR_SECONDS;

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
  pageSize?: number;
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
      variables?: { pair: string; from: number; to: number; first: number };
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

    const { pair, from, to, first } = body.variables ?? { pair: "", from: 0, to: 0, first: 0 };
    windows.push({ pair, from, to });

    if (options.failFor === pair) {
      return new Response("{}", { status: 500 });
    }

    // Honours the window and the page limit, so run-level tests exercise the real cursor.
    const rows = (options.hoursByPair?.[pair] ?? [])
      .filter((row) => row.hourStartUnix >= from && row.hourStartUnix < to)
      .slice(0, first);

    return new Response(JSON.stringify({ data: { pairHourDatas: rows } }));
  };

  return {
    gateway: createGateway({
      url: "https://example.test/api/KEY/subgraphs/id/X",
      fetch,
      ...(options.pageSize === undefined ? {} : { pageSize: options.pageSize }),
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
