import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { BACKFILL_HOURS, FINALITY_MARGIN_SECONDS } from "./constants.ts";

export function effectiveCurrentHour(wallClockSeconds: number, indexerHeadSeconds: number): number {
  const effectiveNow = Math.min(wallClockSeconds, indexerHeadSeconds) - FINALITY_MARGIN_SECONDS;

  return Math.floor(effectiveNow / HOUR_SECONDS) * HOUR_SECONDS;
}

export function lowerBound(lastStoredHour: number | undefined, currentHour: number): number {
  if (lastStoredHour === undefined) {
    return currentHour - BACKFILL_HOURS * HOUR_SECONDS;
  }

  return lastStoredHour + HOUR_SECONDS;
}

export function isDue(from: number, currentHour: number): boolean {
  return from < currentHour;
}

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
