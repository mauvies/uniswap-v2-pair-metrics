import { PAIRS } from "@uniswap-v2-pair-metrics/shared";
import { LAG_WARN_SECONDS } from "./constants.ts";
import { type Db, insertHours, lastStoredHour, toInsertRow } from "./db/index.ts";
import type { Gateway } from "./gateway/index.ts";
import { effectiveCurrentHour, isDue, lowerBound } from "./hours.ts";
import type { Log } from "./log.ts";

export interface RunOptions {
  db: Db;
  gateway: Gateway;
  nowInSeconds: number;
  log: Log;
}

export type PairOutcome =
  | { pair: string; kind: "skipped" }
  | { pair: string; kind: "empty" }
  | { pair: string; kind: "written"; attempted: number; written: number }
  | { pair: string; kind: "failed"; reason: string };

export interface RunSummary {
  pairs: PairOutcome[];
  aborted?: string;
}

export const EXIT_OK = 0;
export const EXIT_PAIR_FAILED = 1;
export const EXIT_ABORTED = 2;

/**
 * 2 rather than 1 when nothing was attempted at all: whoever is on call needs to know
 * whether any pair got as far as a write.
 */
export function exitCodeFor(summary: RunSummary): number {
  if (summary.aborted !== undefined) {
    return EXIT_ABORTED;
  }

  return summary.pairs.some((outcome) => outcome.kind === "failed") ? EXIT_PAIR_FAILED : EXIT_OK;
}

export async function run({ db, gateway, nowInSeconds, log }: RunOptions): Promise<RunSummary> {
  let currentHour: number;

  try {
    const meta = await gateway.meta();
    const lagSeconds = nowInSeconds - meta.block.timestamp;
    currentHour = effectiveCurrentHour(nowInSeconds, meta.block.timestamp);

    log({
      level: lagSeconds > LAG_WARN_SECONDS ? "warn" : "info",
      event: "indexer.head",
      blockTimestamp: meta.block.timestamp,
      lagSeconds,
      effectiveCurrentHour: currentHour,
    });

    if (meta.hasIndexingErrors) {
      log({ level: "warn", event: "indexer.errors" });
    }
  } catch (error) {
    log({ level: "error", event: "run.aborted", reason: String(error) });

    return { aborted: String(error), pairs: [] };
  }

  const pairs: PairOutcome[] = [];

  for (const pair of PAIRS) {
    const outcome = await ingestPair(pair.address, currentHour, { db, gateway, nowInSeconds, log });
    pairs.push(outcome);
  }

  return { pairs };
}

async function ingestPair(
  address: string,
  currentHour: number,
  { db, gateway, log }: RunOptions,
): Promise<PairOutcome> {
  try {
    const last = await lastStoredHour(db, address);
    const from = lowerBound(last, currentHour);

    if (!isDue(from, currentHour)) {
      log({ level: "info", event: "pair.skipped", pair: address, lastStoredHour: last });

      return { pair: address, kind: "skipped" };
    }

    const hours = await gateway.pairHours(address, from, currentHour);

    if (hours.length === 0) {
      log({ level: "info", event: "pair.empty", pair: address, from, to: currentHour });

      return { pair: address, kind: "empty" };
    }

    const rows = hours.map((hour) => toInsertRow(address, hour));
    const written = await insertHours(db, rows);

    log({
      level: "info",
      event: "pair.written",
      pair: address,
      from,
      to: currentHour,
      attempted: rows.length,
      written: written.length,
    });

    return { pair: address, kind: "written", attempted: rows.length, written: written.length };
  } catch (error) {
    // The other pair's transaction has already committed, or will; only this one is lost.
    log({ level: "error", event: "pair.failed", pair: address, reason: String(error) });

    return { pair: address, kind: "failed", reason: String(error) };
  }
}
