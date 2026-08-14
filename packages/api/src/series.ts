import type { AprByWindow, PairHourRow, ReconstructedHour } from "@uniswap-v2-pair-metrics/shared";
import {
  APR_WINDOWS,
  computeAprSeries,
  HOUR_SECONDS,
  reconstructSeries,
} from "@uniswap-v2-pair-metrics/shared";

/** Enough history behind the first point to fill the widest window, and no more (§6.2). */
export const LOOKBACK_HOURS = Math.max(...APR_WINDOWS) - 1;

/** The oldest and newest hour stored for one pair. A pair with no rows has no extent. */
export interface StoredExtent {
  first: number;
  last: number;
}

export interface ResolvedRange {
  fromHourUnix: number;
  toHourUnix: number;
}

/** §6.1's point: persisted metrics as strings, APR the only numeric field. */
export interface MetricPoint {
  hourStartUnix: number;
  reserve0: string;
  reserve1: string;
  liquidityUSD: string;
  volumeToken0: string;
  volumeToken1: string;
  volumeUSD: string;
  feesUSD: string;
  imputed: boolean;
  apr: AprByWindow;
}

/**
 * The hour an instant falls in. Both ends of a request are floored and both are inclusive
 * (§6.1), so a `to` of 23:59:59 keeps the hour that started at 23:00.
 *
 * The caller has already validated the string, so `Date.parse` cannot return NaN here.
 */
export function floorToHour(iso: string): number {
  const seconds = Math.floor(Date.parse(iso) / 1000);

  return Math.floor(seconds / HOUR_SECONDS) * HOUR_SECONDS;
}

export function lookbackStart(fromHour: number): number {
  return fromHour - LOOKBACK_HOURS * HOUR_SECONDS;
}

/**
 * The requested range against what is stored: an absent bound falls back to the stored
 * extent, and a range that does not overlap it at all resolves to nothing (§6.1).
 */
export function resolveHours(
  extent: StoredExtent,
  from: number | undefined,
  to: number | undefined,
): { fromHour: number; toHour: number } | null {
  const fromHour = from ?? extent.first;
  const toHour = to ?? extent.last;

  if (fromHour > extent.last || toHour < extent.first) {
    return null;
  }

  return { fromHour, toHour };
}

/**
 * Reconstruct, annualise, then drop the lookback: the hours before `fromHour` exist to fill
 * the windows of the points that follow them, and are not part of the answer (§6.1).
 */
export function buildPoints(rows: readonly PairHourRow[], fromHour: number): MetricPoint[] {
  const series = reconstructSeries(rows);
  const aprSeries = computeAprSeries(series);

  return aprSeries.flatMap((apr, index) => {
    const hour = series[index];

    // `computeAprSeries` returns one entry per hour; the check is what the compiler needs
    // to read the index, not a case that can happen.
    if (hour === undefined || hour.hourStartUnix < fromHour) {
      return [];
    }

    return [toPoint(hour, apr)];
  });
}

/** The interval actually served, which is what `range` echoes rather than the request. */
export function rangeOf(points: readonly MetricPoint[]): ResolvedRange | null {
  const first = points[0];
  const last = points.at(-1);

  if (first === undefined || last === undefined) {
    return null;
  }

  return { fromHourUnix: first.hourStartUnix, toHourUnix: last.hourStartUnix };
}

function toPoint(hour: ReconstructedHour, apr: AprByWindow): MetricPoint {
  return {
    hourStartUnix: hour.hourStartUnix,
    reserve0: hour.reserve0,
    reserve1: hour.reserve1,
    liquidityUSD: hour.reserveUsd,
    volumeToken0: hour.volumeToken0,
    volumeToken1: hour.volumeToken1,
    volumeUSD: hour.volumeUsd,
    feesUSD: hour.feesUsd,
    imputed: hour.imputed,
    apr,
  };
}
