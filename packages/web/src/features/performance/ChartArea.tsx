import type { MetricPoint } from "@uniswap-v2-pair-metrics/shared";
import { AprChart } from "./AprChart.tsx";
import { toAprSeries } from "./aprSeries.ts";
import { ChartEmptyState, ChartError, ChartSkeleton } from "./chartStates/index.ts";

interface ChartAreaProps {
  points: readonly MetricPoint[] | undefined;
  bounded: boolean;
  isPending: boolean;
  isError: boolean;
}

export function ChartArea({ points, bounded, isPending, isError }: ChartAreaProps) {
  if (isPending) {
    return <ChartSkeleton />;
  }

  if (isError || points === undefined) {
    return <ChartError />;
  }

  if (points.length === 0) {
    return <ChartEmptyState reason={bounded ? "empty-range" : "no-rows"} />;
  }

  const series = toAprSeries(points);

  if (series.data.length === 0) {
    return <ChartEmptyState reason="warming-up" />;
  }

  return <AprChart series={series} />;
}
