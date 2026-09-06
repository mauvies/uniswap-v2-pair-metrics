import { useQuery } from "@tanstack/react-query";
import type { AprWindow, MetricPoint, PairMetrics } from "@uniswap-v2-pair-metrics/shared";

interface UsePairMetrics {
  points: readonly MetricPoint[] | undefined;
  isPending: boolean;
  isError: boolean;
}

/**
 * The window is part of the key, so switching one refetches while React Query keeps
 * serving the window already fetched (§6.2).
 */
export function usePairMetrics(
  address: string,
  from: string | undefined,
  aprWindow: AprWindow,
): UsePairMetrics {
  const { data, isPending, isError } = useQuery({
    queryKey: ["pair-metrics", address, from ?? null, aprWindow],
    queryFn: ({ signal }) => fetchPairMetrics(address, from, aprWindow, signal),
  });

  return { points: data?.points, isPending, isError };
}

async function fetchPairMetrics(
  address: string,
  from: string | undefined,
  aprWindow: AprWindow,
  signal: AbortSignal,
): Promise<PairMetrics> {
  const query = new URLSearchParams({ window: String(aprWindow) });

  if (from !== undefined) {
    query.set("from", from);
  }

  const response = await fetch(`/api/pairs/${address}/metrics?${query}`, { signal });

  if (!response.ok) {
    throw new Error(`The metrics service answered ${response.status}`);
  }

  return (await response.json()) as PairMetrics;
}
