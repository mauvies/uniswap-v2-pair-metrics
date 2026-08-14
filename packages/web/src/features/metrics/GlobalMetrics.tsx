import { MetricCard } from "../../components/ui/MetricCard.tsx";
import { SectionHeading } from "../../components/ui/SectionHeading.tsx";

/**
 * Hardcoded, as the brief allows (§7). None of it derives from the pair metrics — these are
 * the design's own figures, transcribed from docs/design-tokens.md §2.3.
 */
const METRICS: { label: string; value: string; delta?: string }[] = [
  { label: "Total Allocation", value: "$2,533,557.32" },
  { label: "Day Change", value: "+$4,482.29", delta: "(0.18%)" },
  { label: "YTD Change", value: "+$1,360,225", delta: "(115.93%)" },
  { label: "Average Annualized Yield", value: "23%" },
  { label: "Total Depolyed", value: "$21,000,000" },
];

export function GlobalMetrics() {
  return (
    <section>
      <SectionHeading>Global Metrics</SectionHeading>
      <div className="mt-[10px] grid grid-cols-1 gap-[10px] sm:grid-cols-2 xl:grid-cols-[repeat(5,206px)]">
        {METRICS.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
    </section>
  );
}
