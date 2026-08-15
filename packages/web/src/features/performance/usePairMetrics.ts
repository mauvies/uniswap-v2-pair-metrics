import { useQuery } from "@tanstack/react-query";
import type { MetricPoint, PairMetrics } from "@uniswap-v2-pair-metrics/shared";

interface UsePairMetrics {
  points: readonly MetricPoint[] | undefined;
  isPending: boolean;
  isError: boolean;
}

export function usePairMetrics(address: string, from: string | undefined): UsePairMetrics {
  const { data, isPending, isError } = useQuery({
    queryKey: ["pair-metrics", address, from ?? null],
    queryFn: ({ signal }) => fetchPairMetrics(address, from, signal),
  });

  return { points: data?.points, isPending, isError };
}

async function fetchPairMetrics(
  address: string,
  from: string | undefined,
  signal: AbortSignal,
): Promise<PairMetrics> {
  const query = from === undefined ? "" : `?from=${encodeURIComponent(from)}`;
  const response = await fetch(`/api/pairs/${address}/metrics${query}`, { signal });

  if (!response.ok) {
    throw new Error(`The metrics service answered ${response.status}`);
  }

  return (await response.json()) as PairMetrics;
}
