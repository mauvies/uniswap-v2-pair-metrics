import type { AprWindow } from "@uniswap-v2-pair-metrics/shared";
import { HOURS_PER_YEAR } from "@uniswap-v2-pair-metrics/shared";
import type { ReconstructedHour } from "./reconstruct.ts";

const OUTPUT_DECIMALS = 3;

/**
 * Computes the APR for one moving-average window at every point in a
 * reconstructed series (§2.2, §6.2).
 *
 * Requires a contiguous series (guaranteed by `reconstructSeries`). Gaps cause
 * an N-entry window to span more than N hours, producing incorrect values
 * rather than throwing an error.
 */
export function computeAprSeries(
  series: readonly ReconstructedHour[],
  window: AprWindow,
): (number | null)[] {
  return series.map((_, index) => aprAt(series, index, window));
}

function aprAt(
  series: readonly ReconstructedHour[],
  index: number,
  window: AprWindow,
): number | null {
  // Warm-up: fewer hours behind this point than the window needs.
  if (index + 1 < window) {
    return null;
  }

  let yieldSum = 0;

  for (const hour of series.slice(index - window + 1, index + 1)) {
    const fees = Number(hour.feesUsd);
    const liquidity = Number(hour.reserveUsd);

    // PostgreSQL NUMERIC accepts 'NaN', which propagates to JSON as null and
    // could be misinterpreted as a valid warm-up state.
    if (!Number.isFinite(fees) || !Number.isFinite(liquidity)) {
      throw new Error(
        `non-finite reserveUsd or feesUsd in the ${window}h window at index ${index}`,
      );
    }

    if (liquidity <= 0) {
      return null;
    }

    yieldSum += fees / liquidity;
  }

  return round((yieldSum / window) * HOURS_PER_YEAR * 100);
}

function round(value: number): number {
  const factor = 10 ** OUTPUT_DECIMALS;

  return Math.round(value * factor) / factor;
}
