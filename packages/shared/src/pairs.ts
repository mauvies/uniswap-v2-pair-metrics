import type { Pair } from "./types.ts";

/**
 * Constants rather than a table (§9). Token order and symbols verified against the
 * subgraph on 2026-08-12, never re-checked at runtime (§8).
 *
 * WETH/RKFL is dead since 2022-11-29 and belongs here on purpose (§1) — not an oversight.
 */
export const PAIRS: readonly Pair[] = [
  {
    address: "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc",
    token0Symbol: "USDC",
    token1Symbol: "WETH",
  },
  {
    address: "0xbc9d21652cca70f54351e3fb982c6b5dbe992a22",
    token0Symbol: "WETH",
    token1Symbol: "RKFL",
  },
] as const;

/** `undefined` for an address we do not collect, which the API answers 404 (§6.1). */
export function findPair(address: string): Pair | undefined {
  const normalised = address.toLowerCase();

  return PAIRS.find((pair) => pair.address === normalised);
}
