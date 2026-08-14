import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { pairHourMetrics } from "@uniswap-v2-pair-metrics/shared/schema";
import {
  ACTIVE,
  assertReachable,
  DEAD,
  HOUR,
  testPool,
} from "@uniswap-v2-pair-metrics/shared/test-helpers";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RETRY_ATTEMPTS } from "./constants.ts";
import { createDb, insertHours, toInsertRow } from "./db/index.ts";
import { exitCodeFor, run } from "./run.ts";
import {
  BACKFILL_FROM,
  CURRENT_HOUR,
  collectLogs,
  consecutive,
  NOW,
  parsedHour,
  stubGateway,
} from "./support.test-helpers.ts";

const pool = testPool();
const db = createDb(pool);

async function storedHours(pair = ACTIVE): Promise<number[]> {
  const rows = await db
    .select({ hour: pairHourMetrics.hourStartUnix })
    .from(pairHourMetrics)
    .where(eq(pairHourMetrics.pairAddress, pair))
    .orderBy(asc(pairHourMetrics.hourStartUnix));

  return rows.map((row) => row.hour);
}

describe("run", () => {
  beforeAll(() => assertReachable(pool));
  afterAll(() => pool.end());
  beforeEach(() => db.delete(pairHourMetrics));

  it("empty pair → zero writes, exit 0", async () => {
    const { gateway } = stubGateway();
    const { log, lines } = collectLogs();

    const summary = await run({ db, gateway, nowInSeconds: NOW, log });

    expect(await storedHours(DEAD)).toEqual([]);
    expect(exitCodeFor(summary)).toBe(0);
    expect(lines.filter((line) => line.level === "error")).toEqual([]);
  });

  it("missing _meta aborts the run, writes nothing", async () => {
    // Seeded first: "writes nothing" against an empty table would prove less.
    await insertHours(db, [toInsertRow(ACTIVE, parsedHour(HOUR))]);

    const { gateway, windows, metaAttempts } = stubGateway({ meta: "unavailable" });
    const { log } = collectLogs();

    const summary = await run({ db, gateway, nowInSeconds: NOW, log });

    // §8: retried like any request, and only then fatal.
    expect(metaAttempts()).toBe(RETRY_ATTEMPTS);
    expect(exitCodeFor(summary)).toBe(2);
    expect(windows).toEqual([]);
    expect(await storedHours()).toEqual([HOUR]);
  });

  it("hasIndexingErrors → warning, run proceeds", async () => {
    const { gateway } = stubGateway({
      meta: { timestamp: NOW, hasIndexingErrors: true },
      hoursByPair: { [ACTIVE]: consecutive(3) },
    });
    const { log, lines } = collectLogs();

    const summary = await run({ db, gateway, nowInSeconds: NOW, log });

    expect(lines.some((line) => line.event === "indexer.errors" && line.level === "warn")).toBe(
      true,
    );
    expect(await storedHours()).toHaveLength(3);
    expect(exitCodeFor(summary)).toBe(0);
  });

  it("resume after gap backfills every missing hour", async () => {
    const lastStored = CURRENT_HOUR - 5 * HOUR_SECONDS;
    await insertHours(db, [toInsertRow(ACTIVE, parsedHour(lastStored))]);

    const missing = consecutive(4, lastStored + HOUR_SECONDS);
    const { gateway, windows } = stubGateway({ hoursByPair: { [ACTIVE]: missing } });

    await run({ db, gateway, nowInSeconds: NOW, log: collectLogs().log });

    // Picks up from MAX + 1h, never skipping forward (§2.3).
    expect(windows.find((w) => w.pair === ACTIVE)?.from).toBe(lastStored + HOUR_SECONDS);

    const stored = await storedHours();
    expect(stored).toHaveLength(5);
    expect(stored.every((h, i) => i === 0 || h - (stored[i - 1] ?? 0) === HOUR_SECONDS)).toBe(true);
  });

  it("truncated fetch leaves a contiguous series", async () => {
    // A prefix of a longer gap, as an exceeded page limit returns (§9).
    const prefix = consecutive(5);
    const { gateway } = stubGateway({ hoursByPair: { [ACTIVE]: prefix } });

    await run({ db, gateway, nowInSeconds: NOW, log: collectLogs().log });

    const stored = await storedHours();
    expect(stored).toHaveLength(5);
    expect(stored.every((h, i) => i === 0 || h - (stored[i - 1] ?? 0) === HOUR_SECONDS)).toBe(true);

    // The next run resumes from the advanced MAX rather than re-fetching the prefix.
    const second = stubGateway({ hoursByPair: { [ACTIVE]: [] } });
    await run({ db, gateway: second.gateway, nowInSeconds: NOW, log: collectLogs().log });

    expect(second.windows.find((w) => w.pair === ACTIVE)?.from).toBe(
      (stored.at(-1) ?? 0) + HOUR_SECONDS,
    );
  });

  it("no stored row reaches the in-progress hour", async () => {
    const { gateway } = stubGateway({ hoursByPair: { [ACTIVE]: consecutive(48) } });

    await run({ db, gateway, nowInSeconds: NOW, log: collectLogs().log });

    const stored = await storedHours();
    const inProgress = Math.floor(NOW / HOUR_SECONDS) * HOUR_SECONDS;

    expect(stored.at(-1)).toBeLessThan(inProgress);
    // And the newest stored hour has cleared the finality margin.
    expect(NOW - ((stored.at(-1) ?? 0) + HOUR_SECONDS)).toBeGreaterThanOrEqual(900);
  });

  it("mid-run failure → no partial writes", async () => {
    // 30 good hours and one the DDL's alignment CHECK rejects. Zod lets it through —
    // alignment is the column's job (§4) — so the whole batch must roll back.
    const good = consecutive(30);
    const rows = [
      ...good.map((h) => toInsertRow(ACTIVE, { ...h, hourlyTxns: 12 })),
      toInsertRow(ACTIVE, { ...parsedHour(HOUR), hourStartUnix: HOUR + 1 }),
    ];

    await expect(insertHours(db, rows)).rejects.toThrow();
    expect(await storedHours()).toEqual([]);
  });

  it("one pair failing leaves the other committed", async () => {
    const { gateway } = stubGateway({ hoursByPair: { [ACTIVE]: consecutive(3) }, failFor: DEAD });
    const { log } = collectLogs();

    const summary = await run({ db, gateway, nowInSeconds: NOW, log });

    expect(await storedHours(ACTIVE)).toHaveLength(3);
    expect(await storedHours(DEAD)).toEqual([]);
    expect(exitCodeFor(summary)).toBe(1);
  });

  it("crash mid-catch-up commits nothing, rerun converges", async () => {
    const client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO pair_hour_metrics (pair_address, hour_start_unix, reserve0, reserve1,
         reserve_usd, volume_token0, volume_token1, volume_usd, hourly_txns)
       VALUES ($1, $2, '1','1','1','1','1','1', 1)`,
      [ACTIVE, HOUR - 10 * HOUR_SECONDS],
    );
    // Destroying the socket mid-transaction is what a crash is.
    client.release(true);

    expect(await storedHours()).toEqual([]);

    const { gateway } = stubGateway({ hoursByPair: { [ACTIVE]: consecutive(4) } });
    await run({ db, gateway, nowInSeconds: NOW, log: collectLogs().log });

    expect(await storedHours()).toHaveLength(4);
  });

  it("two concurrent runs produce the same table as one", async () => {
    const once = stubGateway({ hoursByPair: { [ACTIVE]: consecutive(6) } });
    await run({ db, gateway: once.gateway, nowInSeconds: NOW, log: collectLogs().log });
    const baseline = await storedHours();

    await db.delete(pairHourMetrics);

    const a = stubGateway({ hoursByPair: { [ACTIVE]: consecutive(6) } });
    const b = stubGateway({ hoursByPair: { [ACTIVE]: consecutive(6) } });
    await Promise.all([
      run({ db, gateway: a.gateway, nowInSeconds: NOW, log: collectLogs().log }),
      run({ db, gateway: b.gateway, nowInSeconds: NOW, log: collectLogs().log }),
    ]);

    expect(await storedHours()).toEqual(baseline);
  });

  it("second run writes nothing", async () => {
    const first = stubGateway({ hoursByPair: { [ACTIVE]: consecutive(4) } });
    await run({ db, gateway: first.gateway, nowInSeconds: NOW, log: collectLogs().log });

    const ingestedAt = async () =>
      db
        .select({ at: pairHourMetrics.ingestedAt })
        .from(pairHourMetrics)
        .orderBy(asc(pairHourMetrics.hourStartUnix));

    const before = await ingestedAt();

    // The cursor has advanced, so a second run asks for a window with nothing in it.
    const second = stubGateway({ hoursByPair: { [ACTIVE]: [] } });
    const summary = await run({
      db,
      gateway: second.gateway,
      nowInSeconds: NOW,
      log: collectLogs().log,
    });

    expect(second.windows.find((w) => w.pair === ACTIVE)?.from).toBe(
      BACKFILL_FROM + 4 * HOUR_SECONDS,
    );
    expect(exitCodeFor(summary)).toBe(0);

    // And re-offering the same rows writes none of them: `ON CONFLICT DO NOTHING`
    // against the natural key, not application logic (§4).
    const again = await insertHours(
      db,
      consecutive(4).map((h) => toInsertRow(ACTIVE, { ...h, hourlyTxns: 12 })),
    );

    expect(again).toEqual([]);
    // A row count cannot tell a no-op from a rewrite; ingested_at can (§4).
    expect(await ingestedAt()).toEqual(before);
  });
});
