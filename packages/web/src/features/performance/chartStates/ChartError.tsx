import { ChartMessage } from "./ChartMessage.tsx";

export function ChartError() {
  return (
    <ChartMessage>
      <div>
        <p className="text-ink font-semibold">The metrics service is not answering</p>
        <p className="mt-2 text-xs text-ink-secondary">
          Nothing was lost. The chart fills in once the service is back.
        </p>
      </div>
    </ChartMessage>
  );
}
