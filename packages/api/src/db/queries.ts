import type { Db } from "@uniswap-v2-pair-metrics/shared/db";
import { pairHourMetrics } from "@uniswap-v2-pair-metrics/shared/schema";
import { max } from "drizzle-orm";

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
