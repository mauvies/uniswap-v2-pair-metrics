import type { AprWindow, MetricPoint } from "@uniswap-v2-pair-metrics/shared";
import { AprChart } from "./AprChart.tsx";
import { toAprSeries } from "./aprSeries.ts";
import { ChartEmptyState, ChartError, ChartSkeleton } from "./chartStates/index.ts";

interface ChartAreaProps {
  points: readonly MetricPoint[] | undefined;
  aprWindow: AprWindow;
  isPending: boolean;
  isError: boolean;
}

export function ChartArea({ points, aprWindow, isPending, isError }: ChartAreaProps) {
  if (isPending) {
    return <ChartSkeleton />;
  }

  if (isError || points === undefined) {
    return <ChartError />;
  }

  if (points.length === 0) {
    return <ChartEmptyState reason="no-rows" />;
  }

  const series = toAprSeries(points, aprWindow);

  if (series.data.length === 0) {
    return <ChartEmptyState reason="warming-up" />;
  }

  return <AprChart series={series} />;
}
