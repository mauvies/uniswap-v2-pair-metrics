import type { PairHourRow } from "@uniswap-v2-pair-metrics/shared";
import { FEE_RATE, HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { ACTIVE, HOUR } from "@uniswap-v2-pair-metrics/shared/test-helpers";
import { describe, expect, it } from "vitest";
import {
  buildPoints,
  floorToHour,
  LOOKBACK_HOURS,
  lookbackStart,
  rangeOf,
  resolveHours,
} from "./series.ts";

function row(hourOffset: number, volumeUsd = "1000"): PairHourRow {
  return {
    pairAddress: ACTIVE,
    hourStartUnix: HOUR + hourOffset * HOUR_SECONDS,
    reserve0: "17000000",
    reserve1: "5000",
    reserveUsd: "17689022.77",
    volumeToken0: "1000",
    volumeToken1: "0.3",
    volumeUsd,
    feesUsd: String(Number(volumeUsd) * FEE_RATE),
    hourlyTxns: 12,
  };
}

function consecutive(count: number, startOffset = 0): PairHourRow[] {
  return Array.from({ length: count }, (_, i) => row(startOffset + i));
}

const EXTENT = { first: HOUR, last: HOUR + 47 * HOUR_SECONDS };

describe("floorToHour", () => {
  it("floors an instant to the hour it falls in", () => {
    expect(floorToHour("2026-08-12T09:00:00Z")).toBe(HOUR);
    expect(floorToHour("2026-08-12T09:30:00Z")).toBe(HOUR);
    expect(floorToHour("2026-08-12T09:59:59Z")).toBe(HOUR);
  });

  it("reads a bare date as midnight UTC", () => {
    expect(floorToHour("2026-08-12")).toBe(HOUR - 9 * HOUR_SECONDS);
  });

  it("reads an offset rather than assuming UTC", () => {
    expect(floorToHour("2026-08-12T11:00:00+02:00")).toBe(HOUR);
  });
});

describe("lookbackStart", () => {
  it("reaches back one hour short of the widest window", () => {
    expect(LOOKBACK_HOURS).toBe(23);
    expect(lookbackStart(HOUR)).toBe(HOUR - 23 * HOUR_SECONDS);
  });
});

describe("resolveHours", () => {
  it("falls back to the stored extent for an absent bound", () => {
    expect(resolveHours(EXTENT, undefined, undefined)).toEqual({
      fromHour: EXTENT.first,
      toHour: EXTENT.last,
    });
    expect(resolveHours(EXTENT, HOUR + HOUR_SECONDS, undefined)?.toHour).toBe(EXTENT.last);
    expect(resolveHours(EXTENT, undefined, HOUR + HOUR_SECONDS)?.fromHour).toBe(EXTENT.first);
  });

  it("keeps the requested bounds when they overlap what is stored", () => {
    const resolved = resolveHours(EXTENT, HOUR - 100 * HOUR_SECONDS, HOUR + 100 * HOUR_SECONDS);

    // Clamping happens in the query and the trim, not here: what is asked for is carried
    // through, and `range` ends up echoing the hours actually served.
    expect(resolved).toEqual({
      fromHour: HOUR - 100 * HOUR_SECONDS,
      toHour: HOUR + 100 * HOUR_SECONDS,
    });
  });

  it("resolves to nothing for a range wholly outside stored history", () => {
    expect(resolveHours(EXTENT, EXTENT.last + HOUR_SECONDS, EXTENT.last + 5 * HOUR_SECONDS)).toBe(
      null,
    );
    expect(resolveHours(EXTENT, EXTENT.first - 5 * HOUR_SECONDS, EXTENT.first - HOUR_SECONDS)).toBe(
      null,
    );
  });
});

describe("buildPoints", () => {
  it("drops the lookback hours from the answer", () => {
    const fromHour = HOUR + 24 * HOUR_SECONDS;
    const points = buildPoints(consecutive(30), fromHour);

    expect(points).toHaveLength(6);
    expect(points[0]?.hourStartUnix).toBe(fromHour);
  });

  it("fills the widest window when the lookback is complete", () => {
    const fromHour = HOUR + 24 * HOUR_SECONDS;
    const points = buildPoints(consecutive(30), fromHour);

    expect(points[0]?.apr["24"]).not.toBe(null);
    expect(points[0]?.apr["12"]).not.toBe(null);
  });

  it("leaves warm-up nulls when the lookback truncates at the start of history", () => {
    const points = buildPoints(consecutive(48), HOUR);

    expect(points.filter((point) => point.apr["1"] === null)).toHaveLength(0);
    expect(points.filter((point) => point.apr["12"] === null)).toHaveLength(11);
    expect(points.filter((point) => point.apr["24"] === null)).toHaveLength(23);
  });

  it("renames the persisted columns to the contract's names", () => {
    const [point] = buildPoints([row(0)], HOUR);

    expect(point).toEqual({
      hourStartUnix: HOUR,
      reserve0: "17000000",
      reserve1: "5000",
      liquidityUSD: "17689022.77",
      volumeToken0: "1000",
      volumeToken1: "0.3",
      volumeUSD: "1000",
      feesUSD: "3",
      imputed: false,
      apr: { "1": expect.any(Number), "12": null, "24": null },
    });
  });

  it("marks the hours it reconstructed", () => {
    const points = buildPoints([row(0), row(3)], HOUR);

    expect(points.map((point) => point.imputed)).toEqual([false, true, true, false]);
  });
});

describe("rangeOf", () => {
  it("echoes the first and last hour served", () => {
    expect(rangeOf(buildPoints(consecutive(5), HOUR))).toEqual({
      fromHourUnix: HOUR,
      toHourUnix: HOUR + 4 * HOUR_SECONDS,
    });
  });

  it("is null when nothing was served", () => {
    expect(rangeOf([])).toBe(null);
  });
});
