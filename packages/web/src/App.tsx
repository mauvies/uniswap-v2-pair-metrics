import { AppShell } from "./components/layout/AppShell.tsx";
import { AnnualizedReturns } from "./features/metrics/AnnualizedReturns.tsx";
import { GlobalMetrics } from "./features/metrics/GlobalMetrics.tsx";
import { PerformanceCard } from "./features/performance/PerformanceCard.tsx";

export function App() {
  return (
    <AppShell>
      <div className="flex flex-col gap-[20px]">
        <GlobalMetrics />
        <AnnualizedReturns />
        <PerformanceCard />
      </div>
    </AppShell>
  );
}
