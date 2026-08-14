import type { PairHourRow } from "@uniswap-v2-pair-metrics/shared";
import type { Db } from "@uniswap-v2-pair-metrics/shared/db";
import { pairHourMetrics } from "@uniswap-v2-pair-metrics/shared/schema";
import { and, asc, eq, lte, max, min, sql } from "drizzle-orm";
import type { StoredExtent } from "../series.ts";

/**
 * The newest stored hour of every pair that has one. A pair with no rows is absent from
 * the map rather than zero, which is what `/health` reports as `null` (§6.1).
 */
export async function latestStoredHours(db: Db): Promise<Map<string, number>> {
  const rows = await db
    .select({
      pairAddress: pairHourMetrics.pairAddress,
      latest: max(pairHourMetrics.hourStartUnix),
    })
    .from(pairHourMetrics)
    .groupBy(pairHourMetrics.pairAddress);

  return new Map(
    rows.flatMap((row) => (row.latest === null ? [] : [[row.pairAddress, row.latest] as const])),
  );
}

/** How far one pair's stored history reaches, or null when it has none (§6.1). */
export async function storedExtent(db: Db, pairAddress: string): Promise<StoredExtent | null> {
  const [row] = await db
    .select({
      first: min(pairHourMetrics.hourStartUnix),
      last: max(pairHourMetrics.hourStartUnix),
    })
    .from(pairHourMetrics)
    .where(eq(pairHourMetrics.pairAddress, pairAddress));

  if (row === undefined || row.first === null || row.last === null) {
    return null;
  }

  return { first: row.first, last: row.last };
}

/**
 * Every row a range needs, ascending: the window `[lookbackFrom, toHour]` and — the part
 * that is easy to leave out — the newest row at or before `lookbackFrom`.
 *
 * That row anchors the reconstruction (§6.1). A pair can be quiet for longer than the
 * lookback, and `hour_start_unix >= lookbackFrom` alone would then start the series inside
 * the requested range, so its first points come back as warm-up `null` when their windows
 * are really full of quiet hours (§2.3).
 *
 * One statement rather than two, so the anchor and the window cannot come from different
 * snapshots.
 */
export async function storedSeries(
  db: Db,
  pairAddress: string,
  lookbackFrom: number,
  toHour: number,
): Promise<PairHourRow[]> {
  const anchored = sql`coalesce((select max(${pairHourMetrics.hourStartUnix})
      from ${pairHourMetrics}
      where ${pairHourMetrics.pairAddress} = ${pairAddress}
        and ${pairHourMetrics.hourStartUnix} <= ${lookbackFrom}), ${lookbackFrom})`;

  // Columns named rather than `select()`: `ingested_at` is storage-only (§4), and pulling
  // it back would put it one spread away from the response.
  return db
    .select({
      pairAddress: pairHourMetrics.pairAddress,
      hourStartUnix: pairHourMetrics.hourStartUnix,
      reserve0: pairHourMetrics.reserve0,
      reserve1: pairHourMetrics.reserve1,
      reserveUsd: pairHourMetrics.reserveUsd,
      volumeToken0: pairHourMetrics.volumeToken0,
      volumeToken1: pairHourMetrics.volumeToken1,
      volumeUsd: pairHourMetrics.volumeUsd,
      feesUsd: pairHourMetrics.feesUsd,
      hourlyTxns: pairHourMetrics.hourlyTxns,
    })
    .from(pairHourMetrics)
    .where(
      and(
        eq(pairHourMetrics.pairAddress, pairAddress),
        lte(pairHourMetrics.hourStartUnix, toHour),
        sql`${pairHourMetrics.hourStartUnix} >= ${anchored}`,
      ),
    )
    .orderBy(asc(pairHourMetrics.hourStartUnix));
}
