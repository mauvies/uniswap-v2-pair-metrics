import type { pairHourMetrics } from "@uniswap-v2-pair-metrics/shared/schema";
import type { PairHour } from "../gateway/schemas.ts";

export type InsertRow = typeof pairHourMetrics.$inferInsert;

export function toInsertRow(pairAddress: string, hour: PairHour): InsertRow {
  return {
    pairAddress,
    hourStartUnix: hour.hourStartUnix,
    reserve0: hour.reserve0,
    reserve1: hour.reserve1,
    reserveUsd: hour.reserveUSD,
    volumeToken0: hour.hourlyVolumeToken0,
    volumeToken1: hour.hourlyVolumeToken1,
    volumeUsd: hour.hourlyVolumeUSD,
    hourlyTxns: hour.hourlyTxns,
  };
}
