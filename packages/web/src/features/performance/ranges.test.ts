import { describe, expect, it } from "vitest";
import { rangeFrom } from "./ranges.ts";

/** 15 August 2026, 13:37:42 UTC — deliberately not on an hour boundary. */
const NOW = Math.floor(Date.UTC(2026, 7, 15, 13, 37, 42) / 1000);

describe("rangeFrom", () => {
  it("asks for no lower bound when the range is everything stored", () => {
    expect(rangeFrom("all", NOW)).toBeUndefined();
  });

  it("counts back from the hour, not from the instant", () => {
    expect(rangeFrom("24h", NOW)).toBe("2026-08-14T13:00:00.000Z");
    expect(rangeFrom("2d", NOW)).toBe("2026-08-13T13:00:00.000Z");
  });

  it("returns the same bound anywhere within one hour", () => {
    const start = Math.floor(Date.UTC(2026, 7, 15, 13, 0, 0) / 1000);
    const end = start + 3599;

    expect(rangeFrom("24h", start)).toBe(rangeFrom("24h", end));
    expect(rangeFrom("24h", end)).not.toBe(rangeFrom("24h", end + 1));
  });
});
