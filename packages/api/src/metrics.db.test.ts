import type { PairMetrics } from "@uniswap-v2-pair-metrics/shared";
import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { pairHourMetrics } from "@uniswap-v2-pair-metrics/shared/schema";
import {
  ACTIVE,
  assertReachable,
  DEAD,
  HOUR,
  testPool,
} from "@uniswap-v2-pair-metrics/shared/test-helpers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { createDb, createPool } from "./db/index.ts";
import { storedRow } from "./support.test-helpers.ts";

const pool = testPool();
const db = createDb(pool);
const app = buildApp({ db, logger: false });

/** An address of the right shape that is deliberately not one of the two configured (§6.1). */
const UNCONFIGURED = "0x0000000000000000000000000000000000000001";

function at(hourOffset: number): number {
  return HOUR + hourOffset * HOUR_SECONDS;
}

function iso(hourUnix: number): string {
  return new Date(hourUnix * 1000).toISOString();
}

function seed(pair: string, offsets: readonly number[]) {
  return db.insert(pairHourMetrics).values(offsets.map((offset) => storedRow(pair, at(offset))));
}

function span(count: number, startOffset = 0): number[] {
  return Array.from({ length: count }, (_, i) => startOffset + i);
}

async function get(
  pair: string,
  range: { from?: number; to?: number } = {},
): Promise<{ statusCode: number; body: PairMetrics }> {
  const search = new URLSearchParams();
  if (range.from !== undefined) {
    search.set("from", iso(range.from));
  }
  if (range.to !== undefined) {
    search.set("to", iso(range.to));
  }

  const query = search.size === 0 ? "" : `?${search}`;
  const response = await app.inject({ method: "GET", url: `/pairs/${pair}/metrics${query}` });

  return { statusCode: response.statusCode, body: response.json<PairMetrics>() };
}

describe("GET /pairs/:address/metrics", () => {
  beforeAll(() => assertReachable(pool));
  afterAll(async () => {
    await app.close();
    await pool.end();
  });
  beforeEach(() => db.delete(pairHourMetrics));

  it("no data → 200 []", async () => {
    await seed(ACTIVE, span(5));

    const { statusCode, body } = await get(DEAD);

    expect(statusCode).toBe(200);
    expect(body.range).toBe(null);
    expect(body.points).toEqual([]);
    expect(body.pair).toEqual({ address: DEAD, token0Symbol: "WETH", token1Symbol: "RKFL" });
  });

  it("disjoint range → 200, null range, empty points", async () => {
    await seed(ACTIVE, span(48));

    const before = await get(ACTIVE, { from: at(-100), to: at(-50) });
    const after = await get(ACTIVE, { from: at(100), to: at(150) });

    for (const { statusCode, body } of [before, after]) {
      expect(statusCode).toBe(200);
      expect(body.range).toBe(null);
      expect(body.points).toEqual([]);
    }
  });

  it("range past last stored hour omits trailing hours, does not impute", async () => {
    await seed(ACTIVE, span(5));

    const { body } = await get(ACTIVE, { from: at(0), to: at(20) });

    expect(body.points).toHaveLength(5);
    expect(body.points.at(-1)?.hourStartUnix).toBe(at(4));
    expect(body.points.some((point) => point.imputed)).toBe(false);
    // The resolved interval, not the one asked for.
    expect(body.range).toEqual({ fromHourUnix: at(0), toHourUnix: at(4) });
  });

  it("lookback window", async () => {
    await seed(ACTIVE, span(30));

    const { body } = await get(ACTIVE, { from: at(24), to: at(29) });

    // The 23 hours before `from` were read but are not part of the answer.
    expect(body.points).toHaveLength(6);
    expect(body.points[0]?.hourStartUnix).toBe(at(24));
    // And they did their job: the first point's widest window is full.
    expect(body.points[0]?.apr["24"]).not.toBe(null);
  });

  it("lookback truncated at start of history → nulls", async () => {
    await seed(ACTIVE, span(48));

    const { body } = await get(ACTIVE, { from: at(0), to: at(47) });

    expect(body.points).toHaveLength(48);
    expect(body.points.filter((point) => point.apr["1"] === null)).toHaveLength(0);
    expect(body.points.filter((point) => point.apr["12"] === null)).toHaveLength(11);
    expect(body.points.filter((point) => point.apr["24"] === null)).toHaveLength(23);
  });

  it("a gap spanning the lookback still fills the window", async () => {
    // One hour of activity, then 39 quiet hours — longer than the 23-hour lookback, so
    // `hour_start_unix >= from - 23h` alone would return only the tail and report the
    // first point as warm-up.
    await seed(ACTIVE, [0, ...span(6, 40)]);

    const { body } = await get(ACTIVE, { from: at(40), to: at(45) });

    expect(body.points).toHaveLength(6);
    expect(body.points[0]?.hourStartUnix).toBe(at(40));
    expect(body.points[0]?.imputed).toBe(false);
    expect(body.points[0]?.apr["24"]).not.toBe(null);
  });

  it("omitted bounds resolve to the stored extent", async () => {
    await seed(ACTIVE, span(10, 5));

    const { body } = await get(ACTIVE);

    expect(body.range).toEqual({ fromHourUnix: at(5), toHourUnix: at(14) });
    expect(body.points).toHaveLength(10);
  });

  it("floors both bounds and includes them", async () => {
    await seed(ACTIVE, span(5));

    const response = await app.inject({
      method: "GET",
      // Half past the first hour, one second short of the end of the third.
      url: `/pairs/${ACTIVE}/metrics?from=${iso(at(0) + 1800)}&to=${iso(at(2) + 3599)}`,
    });

    expect(response.json<PairMetrics>().range).toEqual({
      fromHourUnix: at(0),
      toHourUnix: at(2),
    });
  });

  describe("validation and empty-range suite", () => {
    it("rejects a malformed address with 400", async () => {
      const response = await app.inject({ method: "GET", url: "/pairs/0xnothex/metrics" });

      expect(response.statusCode).toBe(400);
    });

    // Etherscan hands out EIP-55 mixed case, so this is the first thing a reviewer pastes.
    it("accepts an address whose case differs from the stored form", async () => {
      await seed(ACTIVE, span(3));

      const { statusCode, body } = await get(`0x${ACTIVE.slice(2).toUpperCase()}`);

      expect(statusCode).toBe(200);
      expect(body.pair.address).toBe(ACTIVE);
    });

    it("answers 404 for a well-formed address we do not collect", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/pairs/${UNCONFIGURED}/metrics`,
      });

      expect(response.statusCode).toBe(404);
    });

    it("rejects an unparseable date with 400", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/pairs/${ACTIVE}/metrics?from=last%20tuesday`,
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects from after to with 400", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/pairs/${ACTIVE}/metrics?from=${iso(at(10))}&to=${iso(at(2))}`,
      });

      expect(response.statusCode).toBe(400);
    });

    it("answers 200 with an empty array for a valid range holding no rows", async () => {
      await seed(ACTIVE, span(5));

      const { statusCode, body } = await get(DEAD, { from: at(0), to: at(4) });

      expect(statusCode).toBe(200);
      expect(body.points).toEqual([]);
    });
  });

  it("answers 503 with the database unreachable", async () => {
    const downPool = createPool("postgres://uniswap:uniswap@127.0.0.1:1/uniswap_v2_pair_metrics");
    const downApp = buildApp({ db: createDb(downPool), logger: false });

    try {
      const response = await downApp.inject({
        method: "GET",
        url: `/pairs/${ACTIVE}/metrics`,
      });

      expect(response.statusCode).toBe(503);
    } finally {
      await downApp.close();
      await downPool.end();
    }
  });
});
