import { Card } from "./Card.tsx";

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "ink" | "positive";
}

export function MetricCard({ label, value, delta, tone = "ink" }: MetricCardProps) {
  return (
    <Card className="h-[70px] w-full px-[14px] pt-[18px] pb-[16px]">
      <p className="text-[11px] leading-[13px] text-ink">{label}</p>
      <p
        className={`mt-[5px] text-[15px] leading-[18px] font-semibold ${
          tone === "positive" ? "text-positive" : "text-ink"
        }`}
      >
        {value}
        {delta === undefined ? null : <span className="text-positive"> {delta}</span>}
      </p>
    </Card>
  );
}
