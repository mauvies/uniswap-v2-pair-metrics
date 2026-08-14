import { HOUR_SECONDS, PAIRS } from "@uniswap-v2-pair-metrics/shared";
import { pairHourMetrics } from "@uniswap-v2-pair-metrics/shared/schema";
import {
  ACTIVE,
  assertReachable,
  DEAD,
  HOUR,
  testPool,
} from "@uniswap-v2-pair-metrics/shared/test-helpers";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.ts";
import { createDb, createPool } from "./db/index.ts";
import type { Health } from "./health.ts";
import { storedRow } from "./support.test-helpers.ts";

const pool = testPool();
const db = createDb(pool);
const app = buildApp({ db, logger: false });

async function getHealth(): Promise<{ statusCode: number; body: Health }> {
  const response = await app.inject({ method: "GET", url: "/health" });

  return { statusCode: response.statusCode, body: response.json<Health>() };
}

describe("GET /health", () => {
  beforeAll(() => assertReachable(pool));
  afterAll(async () => {
    await app.close();
    await pool.end();
  });
  beforeEach(() => db.delete(pairHourMetrics));
  afterEach(() => void vi.useRealTimers());

  it("ages the newest stored hour from the end of that hour", async () => {
    await db
      .insert(pairHourMetrics)
      .values([storedRow(ACTIVE, HOUR - HOUR_SECONDS), storedRow(ACTIVE, HOUR)]);
    // Five minutes past the end of HOUR: an age counted from its start would read 3900.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime((HOUR + HOUR_SECONDS + 300) * 1000);

    const { statusCode, body } = await getHealth();

    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);
    expect(body.pairs[0]).toEqual({ address: ACTIVE, lastHourStartUnix: HOUR, ageSeconds: 300 });
  });

  it("reports null for a pair with no rows, and still lists it", async () => {
    await db.insert(pairHourMetrics).values([storedRow(ACTIVE, HOUR)]);

    const { statusCode, body } = await getHealth();

    expect(statusCode).toBe(200);
    expect(body.pairs.map((pair) => pair.address)).toEqual(PAIRS.map((pair) => pair.address));
    expect(body.pairs.find((pair) => pair.address === DEAD)).toEqual({
      address: DEAD,
      lastHourStartUnix: null,
      ageSeconds: null,
    });
  });

  it("answers 503 with the database unreachable", async () => {
    // Port 1 refuses immediately, so this does not wait out the connection timeout.
    const downPool = createPool("postgres://uniswap:uniswap@127.0.0.1:1/uniswap_v2_pair_metrics");
    const downApp = buildApp({ db: createDb(downPool), logger: false });

    try {
      const response = await downApp.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(503);
      expect(response.json<Health>()).toEqual({ ok: false, db: false, pairs: [] });
    } finally {
      await downApp.close();
      await downPool.end();
    }
  });
});
