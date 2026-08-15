import { APR_WINDOWS, type AprWindow, findPair, PAIRS } from "@uniswap-v2-pair-metrics/shared";
import { useState } from "react";
import { HelpCircle } from "../../components/icons/index.ts";
import { Card } from "../../components/ui/Card.tsx";
import { IconButton } from "../../components/ui/IconButton.tsx";
import { PillGroup, type PillOption } from "../../components/ui/PillGroup.tsx";
import { SectionHeading } from "../../components/ui/SectionHeading.tsx";
import { ChartArea } from "./ChartArea.tsx";
import { HeaderActions } from "./HeaderActions.tsx";
import { RANGE_OPTIONS, type RangeKey, rangeFrom } from "./ranges.ts";
import { usePairMetrics } from "./usePairMetrics.ts";

const DEFAULT_PAIR = PAIRS[0];

const PAIR_OPTIONS: readonly PillOption<string>[] = PAIRS.map((pair) => ({
  value: pair.address,
  label: `${pair.token0Symbol}/${pair.token1Symbol}`,
}));

const WINDOW_OPTIONS: readonly PillOption<AprWindow>[] = APR_WINDOWS.map((hours) => ({
  value: hours,
  label: `${hours}h`,
}));

export function PerformanceCard() {
  const [address, setAddress] = useState(DEFAULT_PAIR.address);
  const [aprWindow, setAprWindow] = useState<AprWindow>(24);
  const [range, setRange] = useState<RangeKey>("all");

  const pair = findPair(address) ?? DEFAULT_PAIR;
  const from = rangeFrom(range, Math.floor(Date.now() / 1000));

  const { points, isPending, isError } = usePairMetrics(pair.address, from);

  return (
    <section>
      <SectionHeading>Performance</SectionHeading>

      <Card className="mt-[10px] ">
        <div className="flex flex-wrap items-center justify-between gap-[10px] p-[16px]">
          <div className="flex items-center gap-[4px]">
            <h3 className="text-[15px] leading-[23px] font-medium text-ink">
              {pair.token0Symbol}/{pair.token1Symbol}
            </h3>
            <IconButton label="About this chart">
              <HelpCircle />
            </IconButton>
          </div>

          <div className="order-last flex w-full justify-center md:order-none md:w-auto md:flex-1">
            <PillGroup
              label="Pair"
              options={PAIR_OPTIONS}
              value={pair.address}
              onChange={setAddress}
            />
          </div>

          <HeaderActions />
        </div>

        <hr className="border-0 border-t border-divider" />

        <div className="pt-[15px] pr-[30px] pb-[30px]  pl-[16px]">
          <div className="flex items-center gap-[6px] ">
            <span
              aria-hidden="true"
              className="size-[9px] shrink-0 rounded-full bg-accent-legend"
            />
            <span className="text-[11px] leading-[13px] text-ink-secondary">{aprWindow}h APR</span>
          </div>

          <div className="mt-[14px] flex flex-wrap items-center justify-between gap-[10px]">
            <PillGroup
              label="Date range"
              options={RANGE_OPTIONS}
              value={range}
              onChange={setRange}
            />

            <PillGroup
              label="Moving average"
              options={WINDOW_OPTIONS}
              value={aprWindow}
              onChange={setAprWindow}
            />
          </div>

          <div className="h-[334px] mt-[40px]">
            <ChartArea
              points={points}
              isPending={isPending}
              isError={isError}
              aprWindow={aprWindow}
            />
          </div>
        </div>
      </Card>
    </section>
  );
}
