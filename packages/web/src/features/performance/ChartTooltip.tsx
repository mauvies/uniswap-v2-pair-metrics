import type { AprPoint } from "./aprSeries.ts";

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: AprPoint }[];
}

/** UTC, and the hour spelled out, because the axis only has room for a date or `12h`. */
const HOUR_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function ChartTooltip({ active, payload }: ChartTooltipProps) {
  const point = payload?.[0]?.payload;

  if (active !== true || point === undefined) {
    return null;
  }

  return (
    <div className="rounded-field border border-border bg-surface px-[10px] py-[8px] shadow-card">
      <p className="text-[11px] leading-[13px] text-ink-muted">
        {HOUR_LABEL.format(new Date(point.hourStartUnix * 1000))} UTC
      </p>
      <p className="mt-[4px] text-sm leading-[18px] font-semibold text-ink">
        {point.apr === null ? "No value" : `${point.apr.toFixed(3)}%`}
      </p>
      {point.imputed && (
        <p className="mt-[4px] text-[11px] leading-[13px] text-ink-secondary">
          Reconstructed — no trades this hour
        </p>
      )}
    </div>
  );
}
