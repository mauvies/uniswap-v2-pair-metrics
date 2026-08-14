import { MetricCard } from "../../components/ui/MetricCard.tsx";
import { SectionHeading } from "../../components/ui/SectionHeading.tsx";

/** Hardcoded like GlobalMetrics, and whole-value `positive` rather than `ink` (§2.3). */
const RETURNS = [
  { label: "All-Time", value: "8.838%" },
  { label: "30-Day", value: "8.838%" },
  { label: "7-Day", value: "7.382%" },
  { label: "24-Hour", value: "7.765%" },
];

export function AnnualizedReturns() {
  return (
    <section>
      <SectionHeading>Annualized Returns</SectionHeading>
      <div className="mt-[10px] grid grid-cols-1 gap-[10px] sm:grid-cols-2 xl:grid-cols-[repeat(4,206px)]">
        {RETURNS.map(({ label, value }) => (
          <MetricCard key={label} label={label} value={value} tone="positive" />
        ))}
      </div>
    </section>
  );
}
