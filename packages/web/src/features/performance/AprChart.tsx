import type { AprWindow, MetricPoint } from "@uniswap-v2-pair-metrics/shared";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toAprSeries } from "./aprSeries.ts";
import { ChartTooltip } from "./ChartTooltip.tsx";

interface AprChartProps {
  points: readonly MetricPoint[];
  aprWindow: AprWindow;
}

export function AprChart({ points, aprWindow }: AprChartProps) {
  const { data, ticks } = toAprSeries(points, aprWindow);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid vertical={false} className="stroke-grid" strokeWidth={0.6} />
        <XAxis
          dataKey="hourStartUnix"
          type="number"
          domain={["dataMin", "dataMax"]}
          padding={{ left: 30, right: 30 }}
          ticks={ticks}
          tickFormatter={labelFor}
          tickLine={false}
          axisLine={false}
          tickMargin={11}
          tick={{ className: "fill-ink-muted", fontSize: 10 }}
        />
        <YAxis
          width={38}
          domain={[0, "auto"]}
          tickFormatter={(value: number) => `${value}%`}
          tickLine={false}
          axisLine={false}
          tick={{ className: "fill-ink-muted", fontSize: 10 }}
        />
        <Tooltip content={<ChartTooltip />} cursor={false} isAnimationActive={false} />
        <ReferenceLine y={0} className="[&_line]:stroke-grid-baseline" strokeWidth={0.6} />
        <Line
          type="linear"
          dataKey="apr"
          className="[&_.recharts-line-curve]:stroke-primary"
          strokeWidth={1.5}
          connectNulls={false}
          dot={{ r: 3, strokeWidth: 1.5, className: "fill-surface stroke-primary" }}
          activeDot={{ r: 5, strokeWidth: 1.5, className: "fill-surface stroke-primary" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

/** The design alternates a date at midnight with `12h` at noon (§2.4). */
function labelFor(hourStartUnix: number): string {
  const at = new Date(hourStartUnix * 1000);

  return at.getUTCHours() === 0 ? DAY_LABEL.format(at) : "12h";
}
