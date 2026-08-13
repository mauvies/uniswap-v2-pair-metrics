import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { BACKFILL_HOURS, FINALITY_MARGIN_SECONDS } from "./constants.ts";

/**
 * The first hour too recent to store.
 *
 * The margin is subtracted after the `min`, so the finality test runs on the indexer's
 * head — chain time — rather than on the host clock. A clock fifteen minutes fast would
 * otherwise write hours with no margin at all (§5.2).
 */
export function effectiveCurrentHour(wallClockSeconds: number, indexerHeadSeconds: number): number {
  const effectiveNow = Math.min(wallClockSeconds, indexerHeadSeconds) - FINALITY_MARGIN_SECONDS;

  return Math.floor(effectiveNow / HOUR_SECONDS) * HOUR_SECONDS;
}

/**
 * Where the fetch window opens: 48 hours back on a first run, otherwise the hour after the
 * last one stored.
 *
 * Never skips forward, however long the gap. A cap would leave a hole the API cannot tell
 * apart from a quiet period (§2.3).
 */
export function lowerBound(lastStoredHour: number | undefined, currentHour: number): number {
  if (lastStoredHour === undefined) {
    return currentHour - BACKFILL_HOURS * HOUR_SECONDS;
  }

  return lastStoredHour + HOUR_SECONDS;
}

/**
 * Due whenever the half-open window `[from, currentHour)` holds at least one hour.
 *
 * This one comparison is the brief's 60-minute guard. §5.1 argues the two coincide: with
 * only completed hours stored, "the last stored hour ended over 60 minutes ago" and "a new
 * hour has finished upstream and cleared the margin" are the same condition, and both are
 * already folded into `currentHour`. So the guard falls out of the window rather than
 * living beside it as a second threshold that could disagree with it.
 */
export function isDue(from: number, currentHour: number): boolean {
  return from < currentHour;
}

/**
 * Guards our own query construction, not the gateway's honesty: a flipped `orderDirection`
 * or a mis-bound variable would otherwise store hours outside the window, and rows are
 * immutable (§5.1). Without this, `no stored row reaches the in-progress hour` would pin
 * the gateway's `where` filter rather than our code.
 */
export function assertFetchWindow(hours: readonly number[], from: number, to: number): void {
  let previous: number | undefined;

  for (const hour of hours) {
    if (previous !== undefined && hour <= previous) {
      throw new Error(`fetched hours are not ascending: ${previous} then ${hour}`);
    }
    if (hour < from || hour >= to) {
      throw new Error(`fetched hour ${hour} is outside the requested window [${from}, ${to})`);
    }

    previous = hour;
  }
}
