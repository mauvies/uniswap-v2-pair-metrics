import type { AprWindow, MetricPoint } from "@uniswap-v2-pair-metrics/shared";

export interface AprPoint {
  hourStartUnix: number;
  apr: number | null;
  imputed: boolean;
}

export interface AprSeries {
  data: AprPoint[];
  ticks: number[];
}

export function toAprSeries(points: readonly MetricPoint[], aprWindow: AprWindow): AprSeries {
  const series: AprPoint[] = points.map((point) => ({
    hourStartUnix: point.hourStartUnix,
    apr: point.apr[aprWindow],
    imputed: point.imputed,
  }));

  const first = series.findIndex(({ apr }) => apr !== null);
  const last = series.findLastIndex(({ apr }) => apr !== null);
  const data = first === -1 ? [] : series.slice(first, last + 1);

  const ticks = data
    .filter(({ hourStartUnix }) => new Date(hourStartUnix * 1000).getUTCHours() % 12 === 0)
    .map(({ hourStartUnix }) => hourStartUnix);

  return { data, ticks };
}
