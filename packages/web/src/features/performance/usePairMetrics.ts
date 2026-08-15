import { useQuery } from "@tanstack/react-query";
import type { MetricPoint, PairMetrics } from "@uniswap-v2-pair-metrics/shared";

interface UsePairMetrics {
  points: readonly MetricPoint[] | undefined;
  isPending: boolean;
  isError: boolean;
}

export function usePairMetrics(address: string): UsePairMetrics {
  const { data, isPending, isError } = useQuery({
    // The range bounds join the key when the range selector does (§7).
    queryKey: ["pair-metrics", address],
    queryFn: ({ signal }) => fetchPairMetrics(address, signal),
  });

  return { points: data?.points, isPending, isError };
}

async function fetchPairMetrics(address: string, signal: AbortSignal): Promise<PairMetrics> {
  const response = await fetch(`/api/pairs/${address}/metrics`, { signal });

  if (!response.ok) {
    throw new Error(`The metrics service answered ${response.status}`);
  }

  return (await response.json()) as PairMetrics;
}
