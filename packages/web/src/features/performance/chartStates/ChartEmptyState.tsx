import { ChartMessage } from "./ChartMessage.tsx";

type EmptyReason = "no-rows" | "empty-range" | "warming-up";

const COPY: Record<EmptyReason, { title: string; body: string }> = {
  "no-rows": {
    title: "No activity recorded",
    body: "This pair has no stored history. Either it has not traded in the period we track, or its data has not been collected yet.",
  },
  "empty-range": {
    title: "Nothing in this range",
    body: "The stored history holds no hours inside this range. The All range shows everything stored.",
  },
  "warming-up": {
    title: "Not enough history yet",
    body: "Every stored hour still falls inside the first window, so no average can be computed yet. The line appears as soon as one window fills.",
  },
};

export function ChartEmptyState({ reason }: { reason: EmptyReason }) {
  const { title, body } = COPY[reason];

  return (
    <ChartMessage>
      <div>
        <p className="text-ink font-semibold">{title}</p>
        <p className="mt-2 text-xs text-ink-secondary max-w-lg">{body}</p>
      </div>
    </ChartMessage>
  );
}
