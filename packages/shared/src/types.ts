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

export interface Pair {
  address: string;
  token0Symbol: string;
  token1Symbol: string;
}
