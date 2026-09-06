import type { MetricPoint } from "@uniswap-v2-pair-metrics/shared";
import { describe, expect, it } from "vitest";
import { toAprSeries } from "./aprSeries.ts";

const MIDNIGHT = Date.UTC(2026, 7, 12) / 1000;
const HOUR = 3600;

function at(offsetHours: number, apr: number | null): MetricPoint {
  return {
    hourStartUnix: MIDNIGHT + offsetHours * HOUR,
    reserve0: "1",
    reserve1: "1",
    liquidityUSD: "1",
    volumeToken0: "0",
    volumeToken1: "0",
    volumeUSD: "0",
    feesUSD: "0",
    imputed: false,
    apr,
  };
}

describe("toAprSeries", () => {
  it("trims warm-up nulls from both ends", () => {
    const { data } = toAprSeries([at(0, null), at(1, null), at(2, 1), at(3, 2), at(4, null)]);

    expect(data.map(({ apr }) => apr)).toEqual([1, 2]);
    expect(data[0]?.hourStartUnix).toBe(MIDNIGHT + 2 * HOUR);
  });

  /** The reason the trim is anchored to the ends: a hole inside is a fact about the data. */
  it("keeps a null inside the series", () => {
    const { data } = toAprSeries([at(0, 1), at(1, null), at(2, 2)]);

    expect(data.map(({ apr }) => apr)).toEqual([1, null, 2]);
  });

  it("marks a tick every twelve hours", () => {
    const points = Array.from({ length: 25 }, (_, hour) => at(hour, 1));

    expect(toAprSeries(points).ticks).toEqual([
      MIDNIGHT,
      MIDNIGHT + 12 * HOUR,
      MIDNIGHT + 24 * HOUR,
    ]);
  });

  it("has nothing to draw when every hour is still warm-up", () => {
    const { data, ticks } = toAprSeries([at(0, null), at(1, null)]);

    expect(data).toEqual([]);
    expect(ticks).toEqual([]);
  });
});
