import type { APR_WINDOWS } from "./constants.ts";

export type AprWindow = (typeof APR_WINDOWS)[number];

/** Keyed by window as a string so the shape survives JSON unchanged. */
export type AprByWindow = Record<`${AprWindow}`, number | null>;

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
  apr: AprByWindow;
}

export interface PairMetrics {
  pair: Pair;
  range: ResolvedRange | null;
  points: MetricPoint[];
}
