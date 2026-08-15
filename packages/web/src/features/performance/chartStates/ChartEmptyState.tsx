import { ChartMessage } from "./ChartMessage.tsx";

export function ChartEmptyState({ reason }: { reason: "no-rows" | "warming-up" }) {
  return (
    <ChartMessage>
      <div>
        <p className="text-ink font-semibold">
          {reason === "no-rows" ? "No activity recorded" : "Not enough history yet"}
        </p>
        <p className="mt-2 text-xs text-ink-secondary max-w-lg">
          {reason === "no-rows"
            ? "This pair has no hours stored. It has not traded in the window we collect, which is a state of the pool rather than a failure here."
            : "Every stored hour still falls inside the first window, so no average can be computed yet. The line appears as soon as one window fills."}
        </p>
      </div>
    </ChartMessage>
  );
}
