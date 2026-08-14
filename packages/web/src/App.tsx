import { AppShell } from "./components/layout/AppShell.tsx";
import { SectionHeading } from "./components/ui/SectionHeading.tsx";
import { AnnualizedReturns } from "./features/metrics/AnnualizedReturns.tsx";
import { GlobalMetrics } from "./features/metrics/GlobalMetrics.tsx";
import { PerformanceCard } from "./features/performance/PerformanceCard.tsx";

export function App() {
  return (
    <AppShell>
      <div className="flex flex-col gap-[20px]">
        <GlobalMetrics />
        <AnnualizedReturns />
        <section>
          <SectionHeading>Performance</SectionHeading>
          <div className="mt-[10px]">
            <PerformanceCard />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
