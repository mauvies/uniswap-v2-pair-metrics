import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { describe, expect, it } from "vitest";
import { BACKFILL_HOURS, FINALITY_MARGIN_SECONDS } from "./constants.ts";
import { assertFetchWindow, effectiveCurrentHour, isDue, lowerBound } from "./hours.ts";

/** 2026-08-12 09:00:00 UTC, hour-aligned. */
const HOUR = 1_786_525_200;

describe("effectiveCurrentHour", () => {
  it("holds an hour back until the margin has passed", () => {
    const justClosed = HOUR + HOUR_SECONDS;

    // A second after the hour closes, it is still too recent to store.
    expect(effectiveCurrentHour(justClosed + 1, justClosed + 1)).toBe(HOUR);
    // A second before the margin is up, still too recent.
    expect(
      effectiveCurrentHour(justClosed + FINALITY_MARGIN_SECONDS - 1, justClosed + 999_999),
    ).toBe(HOUR);
    // Once it has passed, the hour is fetchable — the window is half-open, so the bound
    // moves to the hour after it.
    expect(effectiveCurrentHour(justClosed + FINALITY_MARGIN_SECONDS, justClosed + 999_999)).toBe(
      justClosed,
    );
  });

  it("lagging indexer bounds upper hour", () => {
    const wallClock = HOUR + 4 * HOUR_SECONDS;
    const indexerHead = HOUR + HOUR_SECONDS;

    // Three hours are complete by the clock, but the indexer has only reached the first.
    expect(effectiveCurrentHour(wallClock, indexerHead)).toBeLessThan(
      effectiveCurrentHour(wallClock, wallClock),
    );
    expect(effectiveCurrentHour(wallClock, indexerHead)).toBe(HOUR);
  });

  it("takes the finality test from chain time, not the host clock", () => {
    const indexerHead = HOUR + HOUR_SECONDS + FINALITY_MARGIN_SECONDS;

    // A clock an hour fast must not move the bound past what the indexer vouches for.
    expect(effectiveCurrentHour(indexerHead + 3600, indexerHead)).toBe(HOUR + HOUR_SECONDS);
    // A slow clock is the conservative direction and is respected.
    expect(effectiveCurrentHour(HOUR, indexerHead)).toBeLessThan(HOUR);
  });
});

describe("lowerBound", () => {
  it("spans exactly the backfill window on a first run", () => {
    expect(effectiveCurrentHour(HOUR + FINALITY_MARGIN_SECONDS, HOUR + 999_999)).toBe(HOUR);
    expect(lowerBound(undefined, HOUR)).toBe(HOUR - BACKFILL_HOURS * HOUR_SECONDS);
    expect((HOUR - lowerBound(undefined, HOUR)) / HOUR_SECONDS).toBe(BACKFILL_HOURS);
  });

  it("resumes from the hour after the last stored, however long the gap", () => {
    const threeDaysBack = HOUR - 72 * HOUR_SECONDS;

    expect(lowerBound(threeDaysBack, HOUR)).toBe(threeDaysBack + HOUR_SECONDS);
    // Never capped: the whole gap is fetched, or the API could not tell a quiet hour from
    // an unfetched one (§2.3).
    expect((HOUR - lowerBound(threeDaysBack, HOUR)) / HOUR_SECONDS).toBe(71);
  });
});

describe("isDue", () => {
  it("is due only when the window holds a whole hour", () => {
    expect(isDue(HOUR, HOUR + HOUR_SECONDS)).toBe(true);
    expect(isDue(HOUR, HOUR)).toBe(false);
    // A rewound indexer is a no-op, not an error.
    expect(isDue(HOUR + HOUR_SECONDS, HOUR)).toBe(false);
  });
});

describe("assertFetchWindow", () => {
  it("accepts an ascending run inside the window", () => {
    expect(() =>
      assertFetchWindow([HOUR, HOUR + HOUR_SECONDS], HOUR, HOUR + 2 * HOUR_SECONDS),
    ).not.toThrow();
    expect(() => assertFetchWindow([], HOUR, HOUR + HOUR_SECONDS)).not.toThrow();
  });

  it("rejects an hour at or past the upper bound", () => {
    expect(() => assertFetchWindow([HOUR], HOUR, HOUR)).toThrow(/outside the requested window/);
  });

  it("rejects an hour before the lower bound, and a descending run", () => {
    expect(() => assertFetchWindow([HOUR - HOUR_SECONDS], HOUR, HOUR + HOUR_SECONDS)).toThrow(
      /outside the requested window/,
    );
    expect(() =>
      assertFetchWindow([HOUR + HOUR_SECONDS, HOUR], HOUR, HOUR + 2 * HOUR_SECONDS),
    ).toThrow(/not ascending/);
    expect(() => assertFetchWindow([HOUR, HOUR], HOUR, HOUR + HOUR_SECONDS)).toThrow(
      /not ascending/,
    );
  });
});
