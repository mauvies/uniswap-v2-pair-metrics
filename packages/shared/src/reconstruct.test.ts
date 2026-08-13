import { describe, expect, it } from "vitest";
import { FEE_RATE, HOUR_SECONDS } from "./constants.ts";
import { reconstructSeries } from "./reconstruct.ts";
import type { PairHourRow } from "./types.ts";

const BASE_HOUR = 1786525200;

function row(hourOffset: number, overrides: Partial<PairHourRow> = {}): PairHourRow {
  const volumeUsd = overrides.volumeUsd ?? "1000";

  return {
    pairAddress: "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc",
    hourStartUnix: BASE_HOUR + hourOffset * HOUR_SECONDS,
    reserve0: "17000000",
    reserve1: "5000",
    reserveUsd: "17689022.77",
    volumeToken0: "1000",
    volumeToken1: "0.3",
    volumeUsd,
    feesUsd: String(Number(volumeUsd) * FEE_RATE),
    hourlyTxns: 12,
    ...overrides,
  };
}

describe("reconstructSeries", () => {
  it("returns an empty series for a pair with no rows", () => {
    expect(reconstructSeries([])).toEqual([]);
  });

  it("leaves a contiguous series untouched", () => {
    const series = reconstructSeries([row(0), row(1), row(2)]);

    expect(series).toHaveLength(3);
    expect(series.every((hour) => hour.imputed)).toBe(false);
  });

  it("fills a gap with zero volume and carried-forward liquidity", () => {
    const before = row(0, { reserveUsd: "17000000", volumeUsd: "5000" });
    const after = row(4, { reserveUsd: "18000000", volumeUsd: "7000" });

    const series = reconstructSeries([before, after]);

    expect(series).toHaveLength(5);
    expect(series.map((hour) => hour.imputed)).toEqual([false, true, true, true, false]);

    for (const filled of series.slice(1, 4)) {
      expect(filled.volumeUsd).toBe("0");
      expect(filled.volumeToken0).toBe("0");
      expect(filled.volumeToken1).toBe("0");
      // Carried forward from the hour before the gap, not from the one after it.
      expect(filled.reserveUsd).toBe("17000000");
    }
  });

  it("imputed points carry zero volume and zero fees", () => {
    const series = reconstructSeries([row(0), row(3)]);
    const imputed = series.filter((hour) => hour.imputed);

    expect(imputed).toHaveLength(2);
    for (const hour of imputed) {
      expect(hour.volumeUsd).toBe("0");
      expect(hour.feesUsd).toBe("0");
    }
  });

  it("never invents hours outside the stored range", () => {
    const series = reconstructSeries([row(2), row(3)]);

    expect(series[0]?.hourStartUnix).toBe(BASE_HOUR + 2 * HOUR_SECONDS);
    expect(series.at(-1)?.hourStartUnix).toBe(BASE_HOUR + 3 * HOUR_SECONDS);
  });

  it("throws on rows that are not strictly ascending", () => {
    expect(() => reconstructSeries([row(3), row(1)])).toThrow(/strictly ascending/);
    expect(() => reconstructSeries([row(1), row(1)])).toThrow(/strictly ascending/);
  });

  it("produces hours one hour apart with no holes", () => {
    const series = reconstructSeries([row(0), row(7), row(9)]);

    expect(series).toHaveLength(10);
    for (let i = 1; i < series.length; i++) {
      const gap = (series[i]?.hourStartUnix ?? 0) - (series[i - 1]?.hourStartUnix ?? 0);
      expect(gap).toBe(HOUR_SECONDS);
    }
  });
});
