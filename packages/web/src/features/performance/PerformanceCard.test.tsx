import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { PairMetrics } from "@uniswap-v2-pair-metrics/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PerformanceCard } from "./PerformanceCard.tsx";

function renderCard(respond: () => Promise<Response>) {
  vi.stubGlobal("fetch", respond);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <PerformanceCard />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: PairMetrics): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "text/plain" } }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PerformanceCard", () => {
  it("loading state while pending", async () => {
    renderCard(() => new Promise<Response>(() => {}));

    expect((await screen.findByRole("status")).textContent).toContain("Recalculating");
    expect(screen.getByRole("heading", { name: "Performance" })).toBeDefined();
    expect(screen.getByText("24h APR")).toBeDefined();
  });

  it("error state renders on failed fetch", async () => {
    renderCard(() => Promise.resolve(new Response("nope", { status: 500 })));

    expect(await screen.findByText("The metrics service is not answering")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Performance" })).toBeDefined();
  });

  it("empty state renders", async () => {
    renderCard(() =>
      jsonResponse({
        pair: { address: "0x0", token0Symbol: "USDC", token1Symbol: "WETH" },
        range: null,
        points: [],
      }),
    );

    expect(await screen.findByText("No activity recorded")).toBeDefined();
  });

  it("names warm-up apart from a pair with no rows", async () => {
    renderCard(() =>
      jsonResponse({
        pair: { address: "0x0", token0Symbol: "USDC", token1Symbol: "WETH" },
        range: { fromHourUnix: 1_786_525_200, toHourUnix: 1_786_528_800 },
        points: [1_786_525_200, 1_786_528_800].map((hourStartUnix) => ({
          hourStartUnix,
          reserve0: "1",
          reserve1: "1",
          liquidityUSD: "1",
          volumeToken0: "0",
          volumeToken1: "0",
          volumeUSD: "0",
          feesUSD: "0",
          imputed: false,
          apr: { "1": 0, "12": null, "24": null },
        })),
      }),
    );

    expect(await screen.findByText("Not enough history yet")).toBeDefined();
  });
});
