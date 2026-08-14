import type { Db } from "@uniswap-v2-pair-metrics/shared/db";
import { pairHourMetrics } from "@uniswap-v2-pair-metrics/shared/schema";
import { eq, max } from "drizzle-orm";
import type { InsertRow } from "./rows.ts";

export async function lastStoredHour(db: Db, pairAddress: string): Promise<number | undefined> {
  const [row] = await db
    .select({ latest: max(pairHourMetrics.hourStartUnix) })
    .from(pairHourMetrics)
    .where(eq(pairHourMetrics.pairAddress, pairAddress));

  return row?.latest ?? undefined;
}

export async function insertHours(db: Db, rows: readonly InsertRow[]): Promise<number[]> {
  if (rows.length === 0) {
    return [];
  }

  return db.transaction(async (tx) => {
    const written = await tx
      .insert(pairHourMetrics)
      .values([...rows])
      .onConflictDoNothing()
      .returning({ hourStartUnix: pairHourMetrics.hourStartUnix });

    return written.map((row) => row.hourStartUnix);
  });
}
