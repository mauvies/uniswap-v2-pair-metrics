import type { PairHourRow } from "@uniswap-v2-pair-metrics/shared";
import { FEE_RATE, HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { describe, expect, it } from "vitest";
import { computeAprSeries } from "./apr.ts";
import { type ReconstructedHour, reconstructSeries } from "./reconstruct.ts";

const BASE_HOUR = 1_786_525_200;

function hour(offset: number, feesUsd: string, reserveUsd = "17689022.77"): ReconstructedHour {
  return {
    hourStartUnix: BASE_HOUR + offset * HOUR_SECONDS,
    reserve0: "17000000",
    reserve1: "5000",
    reserveUsd,
    volumeToken0: "0",
    volumeToken1: "0",
    volumeUsd: String(Number(feesUsd) / FEE_RATE),
    feesUsd,
    imputed: false,
  };
}

/** A flat series: `count` hours, each earning the same fees against the same liquidity. */
function flat(count: number, feesUsd: string, reserveUsd?: string): ReconstructedHour[] {
  return Array.from({ length: count }, (_, i) => hour(i, feesUsd, reserveUsd));
}

describe("computeAprSeries", () => {
  it("matches the worked example in DECISIONS.md §2.2", () => {
    // 24 hours to 2026-08-12 09:00 UTC: $237,045 of volume against $17,689,023 of
    // reserves. Fees are $711.135, annualised $259,564 — 1.467% of the pool.
    const hourlyFees = (237_045 * FEE_RATE) / 24;
    const series = flat(24, String(hourlyFees), "17689023");

    expect(computeAprSeries(series).at(-1)?.["24"]).toBe(1.467);
  });

  it("annualises each window over its own span", () => {
    // $1 of fees an hour against $8,760 of liquidity is exactly 100% a year, whatever
    // the window, because every hour earns the same.
    const series = flat(24, "1", "8760");
    const last = computeAprSeries(series).at(-1);

    expect(last?.["1"]).toBe(100);
    expect(last?.["12"]).toBe(100);
    expect(last?.["24"]).toBe(100);
  });

  it("warm-up null counts", () => {
    const apr = computeAprSeries(flat(48, "1", "8760"));

    expect(apr.filter((point) => point["1"] === null)).toHaveLength(0);
    expect(apr.filter((point) => point["12"] === null)).toHaveLength(11);
    expect(apr.filter((point) => point["24"] === null)).toHaveLength(23);
  });

  it("is null throughout when the series is shorter than the window", () => {
    const apr = computeAprSeries(flat(10, "1", "8760"));

    expect(apr).toHaveLength(10);
    expect(apr.every((point) => point["12"] === null)).toBe(true);
    expect(apr.every((point) => point["24"] === null)).toBe(true);
    // The 1-hour window is complete from the first point.
    expect(apr.every((point) => point["1"] !== null)).toBe(true);
  });

  it("zero liquidity → null", () => {
    const apr = computeAprSeries(flat(24, "1", "0"));

    for (const point of apr) {
      expect(point["1"]).toBeNull();
      expect(point["12"]).toBeNull();
      expect(point["24"]).toBeNull();
    }
    // Never Infinity or NaN: both would serialise to null and silently change value.
    expect(JSON.parse(JSON.stringify(apr))).toEqual(apr);
  });

  it("apr over gapped series", () => {
    // Two observed hours 4 apart, each earning $12. The three quiet hours between them
    // earn nothing, so a 4-hour trailing sum at the last point is $12, not $24 — which
    // is exactly what a row-counting window would get wrong.
    const rows: PairHourRow[] = [0, 4].map((offset) => ({
      pairAddress: "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc",
      hourStartUnix: BASE_HOUR + offset * HOUR_SECONDS,
      reserve0: "1",
      reserve1: "1",
      reserveUsd: "8760",
      volumeToken0: "0",
      volumeToken1: "0",
      volumeUsd: "4000",
      feesUsd: "12",
      hourlyTxns: 1,
    }));

    const series = reconstructSeries(rows);
    const apr = computeAprSeries(series);

    expect(series).toHaveLength(5);
    // 12-hour window is still warming up across only 5 hours.
    expect(apr.at(-1)?.["12"]).toBeNull();
    // 1-hour window at the last point sees the observed $12: 12/8760 × 8760 × 100.
    expect(apr.at(-1)?.["1"]).toBe(1200);
    // The imputed hour before it earned nothing at all.
    expect(apr.at(-2)?.["1"]).toBe(0);
  });

  it("imputed and observed points agree on the fee rate", () => {
    // An imputed hour has zero volume, so it yields zero fees under any rate. Nothing
    // multiplies by FEE_RATE off the database, which is why §4's generated column is
    // the single site for it.
    const series = reconstructSeries([
      {
        pairAddress: "0xb4e1",
        hourStartUnix: BASE_HOUR,
        reserve0: "1",
        reserve1: "1",
        reserveUsd: "8760",
        volumeToken0: "0",
        volumeToken1: "0",
        volumeUsd: "1000",
        feesUsd: "3",
        hourlyTxns: 1,
      },
      {
        pairAddress: "0xb4e1",
        hourStartUnix: BASE_HOUR + 2 * HOUR_SECONDS,
        reserve0: "1",
        reserve1: "1",
        reserveUsd: "8760",
        volumeToken0: "0",
        volumeToken1: "0",
        volumeUsd: "1000",
        feesUsd: "3",
        hourlyTxns: 1,
      },
    ]);

    const imputed = series.filter((point) => point.imputed);

    expect(imputed).toHaveLength(1);
    expect(Number(imputed[0]?.feesUsd)).toBe(Number(imputed[0]?.volumeUsd) * FEE_RATE);

    const observed = series.filter((point) => !point.imputed);

    for (const point of observed) {
      expect(Number(point.feesUsd)).toBeCloseTo(Number(point.volumeUsd) * FEE_RATE, 10);
    }
  });

  it("throws rather than serialising a corrupt value as null", () => {
    const series = flat(2, "1", "8760");
    const badFees = series.map((p, i) => (i === 1 ? { ...p, feesUsd: "NaN" } : p));
    const badLiquidity = series.map((p, i) => (i === 1 ? { ...p, reserveUsd: "NaN" } : p));

    expect(() => computeAprSeries(badFees)).toThrow(/non-finite/);
    expect(() => computeAprSeries(badLiquidity)).toThrow(/non-finite/);
  });

  it("returns every window on every point", () => {
    const apr = computeAprSeries(flat(3, "1", "8760"));

    for (const point of apr) {
      expect(Object.keys(point).sort()).toEqual(["1", "12", "24"]);
    }
  });
});
