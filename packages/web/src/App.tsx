import { AppShell } from "./components/layout/AppShell.tsx";
import { AnnualizedReturns } from "./features/metrics/AnnualizedReturns.tsx";
import { GlobalMetrics } from "./features/metrics/GlobalMetrics.tsx";

/** 20px between a section's cards and the next section's title (§2.3). */
export function App() {
  return (
    <AppShell>
      <div className="flex flex-col gap-[20px]">
        <GlobalMetrics />
        <AnnualizedReturns />
      </div>
    </AppShell>
  );
}
