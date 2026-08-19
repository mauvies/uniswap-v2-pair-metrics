import type { AprByWindow, AprWindow } from "@uniswap-v2-pair-metrics/shared";
import { APR_WINDOWS, HOURS_PER_YEAR } from "@uniswap-v2-pair-metrics/shared";
import type { ReconstructedHour } from "./reconstruct.ts";

const OUTPUT_DECIMALS = 3;

/**
 * Computes the APR for all three moving-average windows at every point in a
 * reconstructed series (§2.2, §6.2).
 *
 * Requires a contiguous series (guaranteed by `reconstructSeries`). Gaps cause
 * an N-entry window to span more than N hours, producing incorrect values
 * rather than throwing an error.
 */
export function computeAprSeries(series: readonly ReconstructedHour[]): AprByWindow[] {
  return series.map((point, index) => {
    const apr = {} as AprByWindow;

    for (const window of APR_WINDOWS) {
      apr[window] = aprAt(series, point, index, window);
    }

    return apr;
  });
}

function aprAt(
  series: readonly ReconstructedHour[],
  point: ReconstructedHour,
  index: number,
  window: AprWindow,
): number | null {
  // Warm-up: fewer hours behind this point than the window needs.
  if (index + 1 < window) {
    return null;
  }

  const liquidity = Number(point.reserveUsd);
  const fees = series
    .slice(index - window + 1, index + 1)
    .reduce((total, hour) => total + Number(hour.feesUsd), 0);

  // PostgreSQL NUMERIC accepts 'NaN', which propagates to JSON as null and
  // could be misinterpreted as a valid warm-up state.
  if (!Number.isFinite(liquidity) || !Number.isFinite(fees)) {
    throw new Error(`non-finite reserveUsd or feesUsd in the ${window}h window at index ${index}`);
  }

  if (liquidity <= 0) {
    return null;
  }

  const annualised = (fees / liquidity) * (HOURS_PER_YEAR / window) * 100;

  return round(annualised);
}

function round(value: number): number {
  const factor = 10 ** OUTPUT_DECIMALS;

  return Math.round(value * factor) / factor;
}
