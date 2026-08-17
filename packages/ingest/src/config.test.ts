import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("names the variable that is missing", () => {
    expect(() => loadConfig({})).toThrow(/THEGRAPH_API_KEY is not set/);
    expect(() => loadConfig({ THEGRAPH_API_KEY: "" })).toThrow(/THEGRAPH_API_KEY is not set/);
  });

  it("builds the gateway URL around the key", () => {
    const { gatewayUrl } = loadConfig({ THEGRAPH_API_KEY: "abc123" });

    expect(gatewayUrl).toBe(
      "https://gateway.thegraph.com/api/abc123/subgraphs/id/A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum",
    );
  });
});
