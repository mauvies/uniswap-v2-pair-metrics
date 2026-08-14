import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { FEE_RATE, HOUR_SECONDS } from "../constants.ts";

// Rendered into DDL, so each constant has one home (§4). sql.raw because a bound
// parameter cannot appear in DDL — interpolating directly produces `$1`.
const feeRate = sql.raw(String(FEE_RATE));
const hourSeconds = sql.raw(String(HOUR_SECONDS));

export const pairHourMetrics = pgTable(
  "pair_hour_metrics",
  {
    pairAddress: text("pair_address").notNull(),
    hourStartUnix: integer("hour_start_unix").notNull(),
    reserve0: numeric("reserve0").notNull(),
    reserve1: numeric("reserve1").notNull(),
    reserveUsd: numeric("reserve_usd").notNull(),
    volumeToken0: numeric("volume_token0").notNull(),
    volumeToken1: numeric("volume_token1").notNull(),
    volumeUsd: numeric("volume_usd").notNull(),
    // Drizzle does not infer NOT NULL for a generated column, so it is declared.
    feesUsd: numeric("fees_usd").generatedAlwaysAs(sql`volume_usd * ${feeRate}`).notNull(),
    // mode "number": realistic counts sit ~12 orders of magnitude under 2^53, and a
    // BigInt would not survive JSON.stringify.
    hourlyTxns: bigint("hourly_txns", { mode: "number" }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.pairAddress, table.hourStartUnix] }),
    check(
      "hour_start_unix_aligned",
      sql`${table.hourStartUnix} > 0 AND ${table.hourStartUnix} % ${hourSeconds} = 0`,
    ),
  ],
);
