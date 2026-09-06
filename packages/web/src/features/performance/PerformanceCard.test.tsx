import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
        aprWindowHours: 24,
        range: null,
        points: [],
      }),
    );

    expect(await screen.findByText("No activity recorded")).toBeDefined();
    expect(screen.getByText(/or its data has not been collected/)).toBeDefined();
  });

  it("names an empty range apart from a pair with no rows", async () => {
    renderCard(() =>
      jsonResponse({
        pair: { address: "0x0", token0Symbol: "USDC", token1Symbol: "WETH" },
        aprWindowHours: 24,
        range: null,
        points: [],
      }),
    );

    expect(await screen.findByText("No activity recorded")).toBeDefined();

    const ranges = screen.getByRole("group", { name: "Date range" });
    fireEvent.click(within(ranges).getByRole("button", { name: "24h" }));

    expect(await screen.findByText("Nothing in this range")).toBeDefined();
    expect(screen.queryByText("No activity recorded")).toBeNull();
  });

  it("names warm-up apart from a pair with no rows", async () => {
    renderCard(() =>
      jsonResponse({
        pair: { address: "0x0", token0Symbol: "USDC", token1Symbol: "WETH" },
        aprWindowHours: 24,
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
          apr: null,
        })),
      }),
    );

    expect(await screen.findByText("Not enough history yet")).toBeDefined();
  });
});
