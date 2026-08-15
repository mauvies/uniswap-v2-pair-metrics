import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import type { PillOption } from "../../components/ui/PillGroup.tsx";

export type RangeKey = "24h" | "2d" | "all";

export const RANGE_OPTIONS: readonly PillOption<RangeKey>[] = [
  { value: "24h", label: "24h" },
  { value: "2d", label: "2d" },
  { value: "all", label: "All" },
];

const HOURS_FROM_RANGE: Record<RangeKey, number | undefined> = {
  "24h": 24,
  "2d": 48,
  all: undefined,
};

export function rangeFrom(range: RangeKey, nowInSeconds: number): string | undefined {
  const hours = HOURS_FROM_RANGE[range];

  if (hours === undefined) {
    return undefined;
  }

  const currentHour = Math.floor(nowInSeconds / HOUR_SECONDS) * HOUR_SECONDS;

  return new Date((currentHour - hours * HOUR_SECONDS) * 1000).toISOString();
}
