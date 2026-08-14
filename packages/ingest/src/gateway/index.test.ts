import { describe, expect, it } from "vitest";
import { RETRY_ATTEMPTS } from "../constants.ts";
import { GatewayError } from "./failures.ts";
import { createGateway } from "./index.ts";

const URL = "https://gateway.thegraph.com/api/SECRET_KEY/subgraphs/id/whatever";

const META = { _meta: { block: { timestamp: 1786527767 }, hasIndexingErrors: false } };

/** Answers every request the same way, and records what was asked. */
function alwaysAnswers(body: unknown, status = 200) {
  const requests: { query: string; variables?: Record<string, unknown> }[] = [];

  const fetch: typeof globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));

    return new Response(JSON.stringify(body), { status });
  };

  return { fetch, requests };
}

/** Nothing waits in these tests; the backoff values are asserted in classify.test.ts. */
const sleep = async () => {};

describe("createGateway", () => {
  it("sends first, the window and ascending order", async () => {
    const stub = alwaysAnswers({ data: { pairHourDatas: [] } });
    const gateway = createGateway({ url: URL, fetch: stub.fetch, pageSize: 5, sleep });

    await gateway.pairHours("0xb4e1", 1786525200, 1786611600);

    expect(stub.requests[0]?.variables).toEqual({
      pair: "0xb4e1",
      from: 1786525200,
      to: 1786611600,
      first: 5,
    });
    expect(stub.requests[0]?.query).toContain("orderBy: hourStartUnix");
    expect(stub.requests[0]?.query).toContain("orderDirection: asc");
  });

  it("rejects a row outside the window it asked for", async () => {
    const from = 1786525200;
    const to = from + 2 * 3600;
    // The gateway is not asked whether it honoured the filter; this catches our own
    // query going wrong, which would otherwise store an hour that is still in progress.
    const stub = alwaysAnswers({
      data: {
        pairHourDatas: [
          {
            hourStartUnix: 1786532400,
            reserve0: "1",
            reserve1: "1",
            reserveUSD: "1",
            hourlyVolumeToken0: "0",
            hourlyVolumeToken1: "0",
            hourlyVolumeUSD: "0",
            hourlyTxns: "1",
          },
        ],
      },
    });
    const gateway = createGateway({ url: URL, fetch: stub.fetch, sleep });

    await expect(gateway.pairHours("0xb4e1", from, to)).rejects.toThrow(
      /outside the requested window/,
    );
  });

  it("rejects rows that come back out of order", async () => {
    const from = 1786525200;
    const stub = alwaysAnswers({
      data: {
        pairHourDatas: [
          {
            hourStartUnix: 1786528800,
            reserve0: "1",
            reserve1: "1",
            reserveUSD: "1",
            hourlyVolumeToken0: "0",
            hourlyVolumeToken1: "0",
            hourlyVolumeUSD: "0",
            hourlyTxns: "1",
          },
          {
            hourStartUnix: 1786525200,
            reserve0: "1",
            reserve1: "1",
            reserveUSD: "1",
            hourlyVolumeToken0: "0",
            hourlyVolumeToken1: "0",
            hourlyVolumeUSD: "0",
            hourlyTxns: "1",
          },
        ],
      },
    });
    const gateway = createGateway({ url: URL, fetch: stub.fetch, sleep });

    await expect(gateway.pairHours("0xb4e1", from, from + 3 * 3600)).rejects.toThrow(
      /not ascending/,
    );
  });

  it("gives up after the last attempt", async () => {
    const stub = alwaysAnswers({}, 500);
    const gateway = createGateway({ url: URL, fetch: stub.fetch, sleep });

    await expect(gateway.meta()).rejects.toThrow(GatewayError);
    expect(stub.requests).toHaveLength(RETRY_ATTEMPTS);
  });

  it("fails fast on an auth error, which arrives inside HTTP 200", async () => {
    const stub = alwaysAnswers({ errors: [{ message: "auth error: malformed API key" }] });
    const gateway = createGateway({ url: URL, fetch: stub.fetch, sleep });

    await expect(gateway.meta()).rejects.toMatchObject({ failure: { kind: "graphql-errors" } });
    expect(stub.requests).toHaveLength(1);
  });

  it("fails fast on a shape it does not recognise", async () => {
    const stub = alwaysAnswers({ data: { _meta: null } });
    const gateway = createGateway({ url: URL, fetch: stub.fetch, sleep });

    await expect(gateway.meta()).rejects.toMatchObject({ failure: { kind: "invalid-shape" } });
    expect(stub.requests).toHaveLength(1);
  });

  it("retries a 503 and succeeds on a later attempt", async () => {
    let calls = 0;

    const fetch: typeof globalThis.fetch = async () => {
      calls += 1;

      return calls < 3
        ? new Response("{}", { status: 503 })
        : new Response(JSON.stringify({ data: META }));
    };

    const gateway = createGateway({ url: URL, fetch, sleep });

    expect((await gateway.meta()).block.timestamp).toBe(1786527767);
    expect(calls).toBe(3);
  });

  it("retries a transport failure", async () => {
    let calls = 0;
    const fetch: typeof globalThis.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        throw new Error("ECONNRESET");
      }

      return new Response(JSON.stringify({ data: META }));
    };

    const gateway = createGateway({ url: URL, fetch, sleep });

    await gateway.meta();
    expect(calls).toBe(2);
  });

  it("never leaks the API key through a thrown error", async () => {
    const stub = alwaysAnswers({ errors: [{ message: "boom" }] });
    const gateway = createGateway({ url: URL, fetch: stub.fetch, sleep });

    const thrown = await gateway.meta().catch((error: unknown) => String(error));

    expect(thrown).not.toContain("SECRET_KEY");
  });
});
