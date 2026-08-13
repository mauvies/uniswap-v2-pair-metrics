import { describe, expect, it } from "vitest";
import { envelope, metaResponse, pairHoursResponse } from "./responses.ts";

/** A real row, trimmed to the fields fetched. */
function hour(overrides: Record<string, unknown> = {}) {
  return {
    hourStartUnix: 1786525200,
    reserve0: "17000000",
    reserve1: "5000",
    reserveUSD: "17594144.06839686623525025832575509",
    hourlyVolumeToken0: "1000",
    hourlyVolumeToken1: "0.3",
    hourlyVolumeUSD: "10791.35818762760589895884675527259",
    hourlyTxns: "22",
    ...overrides,
  };
}

const parse = (h: Record<string, unknown>) => pairHoursResponse.safeParse({ pairHourDatas: [h] });

describe("pairHoursResponse", () => {
  it("accepts the full range the two pairs actually span", () => {
    // Live USDC/WETH, the dead pair's last reserves, and a quiet hour. Measured 2026-08-13.
    for (const value of [
      "0",
      "0.000000008423729439481026545405760632628317",
      "17594144.06839686623525025832575509",
    ]) {
      expect(parse(hour({ reserveUSD: value })).success).toBe(true);
    }
  });

  it("keeps decimals as strings, losing no digits", () => {
    const long = "0.000000008423729439481026545405760632628317";
    const parsed = pairHoursResponse.parse({ pairHourDatas: [hour({ reserveUSD: long })] });

    expect(parsed.pairHourDatas[0]?.reserveUSD).toBe(long);
  });

  it.each(["NaN", "Infinity", "-Infinity", "-1", "", " 1 ", "0x10", "1e400", "1e-9"])(
    "rejects %o, which NUMERIC would have accepted",
    (value) => {
      expect(parse(hour({ reserveUSD: value })).success).toBe(false);
      expect(parse(hour({ hourlyVolumeUSD: value })).success).toBe(false);
    },
  );

  it("rejects a renamed field rather than letting it reach the chart", () => {
    const renamed = hour({ reserveUSD: undefined, reserveUsd: "1" });

    expect(parse(renamed).success).toBe(false);
  });

  it("rejects a nulled field", () => {
    expect(parse(hour({ reserveUSD: null })).success).toBe(false);
    expect(parse(hour({ hourStartUnix: null })).success).toBe(false);
  });

  it("reads hourlyTxns from its string, and rejects one that is not a count", () => {
    const parsed = pairHoursResponse.parse({ pairHourDatas: [hour()] });

    expect(parsed.pairHourDatas[0]?.hourlyTxns).toBe(22);
    // "" and "0x16" are the ones that matter: Number() turns them into 0 and 22, both
    // safe integers, so only the digits-only shape rejects them.
    for (const value of ["", " 22 ", "0x16", "22.5", "many"]) {
      expect(parse(hour({ hourlyTxns: value })).success).toBe(false);
    }
  });

  it("rejects a misaligned hour here rather than at the insert", () => {
    expect(parse(hour({ hourStartUnix: 1786525201 })).success).toBe(false);
  });
});

describe("metaResponse", () => {
  it("accepts the indexer head", () => {
    const parsed = metaResponse.parse({
      _meta: { block: { timestamp: 1786527767 }, hasIndexingErrors: false },
    });

    expect(parsed._meta.block.timestamp).toBe(1786527767);
  });

  it("rejects a missing _meta, which is what aborts the run", () => {
    expect(metaResponse.safeParse({ _meta: null }).success).toBe(false);
    expect(metaResponse.safeParse({}).success).toBe(false);
  });
});

describe("envelope", () => {
  it("parses a reply carrying errors and no data", () => {
    const parsed = envelope.parse({ errors: [{ message: "auth error: malformed API key" }] });

    expect(parsed.errors?.[0]?.message).toContain("auth error");
    expect(parsed.data).toBeUndefined();
  });
});
