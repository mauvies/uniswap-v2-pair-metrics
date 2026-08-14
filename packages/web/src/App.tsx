import { AppShell } from "./components/layout/AppShell.tsx";

/**
 * The shell is real; what it wraps is still the placeholder card from the scaffold commit,
 * kept only so the content area is not empty. `GlobalMetrics` and `AnnualizedReturns`
 * replace it next, and every value here is from docs/design-tokens.md §2.3.
 */
export function App() {
  return (
    <AppShell>
      <h2 className="text-[15px] font-medium text-ink-heading">Global Metrics</h2>
      <section className="mt-[10px] h-[70px] w-[206px] rounded-card border border-border bg-surface px-[14px] pt-[18px] shadow-card">
        <p className="text-[11px] leading-[13px] text-ink">Total Allocation</p>
        <p className="mt-[5px] text-[15px] leading-[18px] font-semibold text-ink">$2,533,557.32</p>
      </section>
    </AppShell>
  );
}
