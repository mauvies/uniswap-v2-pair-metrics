import type { PairHourRow } from "@uniswap-v2-pair-metrics/shared";
import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";

/** One entry per hour, no holes. `imputed` marks an hour the subgraph never wrote (§2.3). */
export interface ReconstructedHour {
  hourStartUnix: number;
  reserve0: string;
  reserve1: string;
  reserveUsd: string;
  volumeToken0: string;
  volumeToken1: string;
  volumeUsd: string;
  feesUsd: string;
  imputed: boolean;
}

/**
 * Fills quiet hours between stored rows (§2.3).
 *
 * Throws if rows are not strictly ascending. A query missing an `ORDER BY`
 * or selecting multiple pairs at once would otherwise bypass the fill loop,
 * returning a series whose moving windows span incorrect time intervals.
 *
 * @param rows Stored hours for a single pair, ordered ascending by `hourStartUnix`.
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

/** Zero volume means zero fees at any rate, so §4's generated column stays its only site. */
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
