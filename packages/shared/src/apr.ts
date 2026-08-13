import { APR_WINDOWS, HOURS_PER_YEAR } from "./constants.ts";
import type { AprByWindow, AprWindow, ReconstructedHour } from "./types.ts";

const OUTPUT_DECIMALS = 3;

/**
 * APR at every point of a reconstructed series, for all three windows (§2.2, §6.2).
 *
 * The series must be contiguous — `reconstructSeries` guarantees it. A gap makes a window
 * of N entries span more than N hours, which yields wrong numbers rather than an error.
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

  // `NUMERIC` accepts 'NaN' and the generated column propagates it, so a corrupt value is
  // reachable from stored data. Unguarded it reaches JSON as null and passes for warm-up.
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
