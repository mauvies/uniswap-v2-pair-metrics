import { HOUR_SECONDS } from "./constants.ts";
import type { PairHourRow, ReconstructedHour } from "./types.ts";

/**
 * Fill the quiet hours between stored rows (§2.3).
 *
 *
 * Throws on rows that are not strictly ascending. A query missing its `ORDER BY`, or one
 * selecting both pairs at once, would otherwise skip the fill loop and hand back a series
 * whose windows silently span the wrong number of hours.
 *
 * @param rows stored hours for one pair, ascending by `hourStartUnix`
 */
export function reconstructSeries(rows: readonly PairHourRow[]): ReconstructedHour[] {
  const first = rows[0];
  if (first === undefined) {
    return [];
  }

  const series: ReconstructedHour[] = [observed(first)];
  let previous = first;

  for (const row of rows.slice(1)) {
    if (row.hourStartUnix <= previous.hourStartUnix) {
      throw new Error(
        `rows must be strictly ascending by hourStartUnix, got ${previous.hourStartUnix} then ${row.hourStartUnix}`,
      );
    }

    for (
      let hour = previous.hourStartUnix + HOUR_SECONDS;
      hour < row.hourStartUnix;
      hour += HOUR_SECONDS
    ) {
      series.push(quiet(hour, previous));
    }

    series.push(observed(row));
    previous = row;
  }

  return series;
}

function observed(row: PairHourRow): ReconstructedHour {
  return {
    hourStartUnix: row.hourStartUnix,
    reserve0: row.reserve0,
    reserve1: row.reserve1,
    reserveUsd: row.reserveUsd,
    volumeToken0: row.volumeToken0,
    volumeToken1: row.volumeToken1,
    volumeUsd: row.volumeUsd,
    feesUsd: row.feesUsd,
    imputed: false,
  };
}

/**
 * Zero volume means zero fees under any rate, so the fee rate never enters this path. That
 * is what keeps §4's generated column the single site for it.
 */
function quiet(hourStartUnix: number, carriedFrom: PairHourRow): ReconstructedHour {
  return {
    hourStartUnix,
    reserve0: carriedFrom.reserve0,
    reserve1: carriedFrom.reserve1,
    reserveUsd: carriedFrom.reserveUsd,
    volumeToken0: "0",
    volumeToken1: "0",
    volumeUsd: "0",
    feesUsd: "0",
    imputed: true,
  };
}
