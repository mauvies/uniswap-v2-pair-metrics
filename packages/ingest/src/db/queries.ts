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

/**
 * The driver caps a statement at 65,535 bind parameters — nine per row here, so a
 * paginated catch-up (§5.5) can overrun a single INSERT. Chunks stay inside the one
 * transaction, so the batch still commits or rolls back whole.
 */
const INSERT_CHUNK_ROWS = 5000;

export async function insertHours(db: Db, rows: readonly InsertRow[]): Promise<number[]> {
  if (rows.length === 0) {
    return [];
  }

  return db.transaction(async (tx) => {
    const written: number[] = [];

    for (let i = 0; i < rows.length; i += INSERT_CHUNK_ROWS) {
      const chunk = await tx
        .insert(pairHourMetrics)
        .values(rows.slice(i, i + INSERT_CHUNK_ROWS))
        .onConflictDoNothing()
        .returning({ hourStartUnix: pairHourMetrics.hourStartUnix });

      written.push(...chunk.map((row) => row.hourStartUnix));
    }

    return written;
  });
}
