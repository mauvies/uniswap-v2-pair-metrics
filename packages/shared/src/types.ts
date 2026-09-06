import type { APR_WINDOWS } from "./constants.ts";

export type AprWindow = (typeof APR_WINDOWS)[number];

export interface PairHourRow {
  pairAddress: string;
  hourStartUnix: number;
  reserve0: string;
  reserve1: string;
  reserveUsd: string;
  volumeToken0: string;
  volumeToken1: string;
  volumeUsd: string;
  feesUsd: string;
  hourlyTxns: number;
}

export interface Pair {
  address: string;
  token0Symbol: string;
  token1Symbol: string;
}

// The three below are §6.1's response. They live here, not in `api`, because the web
// app reads the same shape: a contract two packages depend on belongs in the package
// they share.

/** The interval actually served, which `range` echoes rather than the one requested. */
export interface ResolvedRange {
  fromHourUnix: number;
  toHourUnix: number;
}

/** Persisted metrics as strings, APR the only numeric field. */
export interface MetricPoint {
  hourStartUnix: number;
  reserve0: string;
  reserve1: string;
  liquidityUSD: string;
  volumeToken0: string;
  volumeToken1: string;
  volumeUSD: string;
  feesUSD: string;
  imputed: boolean;
  apr: number | null;
}

export interface PairMetrics {
  pair: Pair;
  /** The window served, which the response echoes because `window` may be defaulted. */
  aprWindowHours: AprWindow;
  range: ResolvedRange | null;
  points: MetricPoint[];
}
