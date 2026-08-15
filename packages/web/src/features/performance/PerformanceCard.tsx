import { type AprWindow, PAIRS } from "@uniswap-v2-pair-metrics/shared";
import { Download, Expand, HelpCircle, MoreVertical, Share } from "../../components/icons/index.ts";
import { Card } from "../../components/ui/Card.tsx";
import { IconButton } from "../../components/ui/IconButton.tsx";
import { SectionHeading } from "../../components/ui/SectionHeading.tsx";
import { AprChart } from "./AprChart.tsx";
import { usePairMetrics } from "./usePairMetrics.ts";

/**
 * The pair and window the card describes. Both become selector state in a later commit.
 */
const PAIR = PAIRS[0];
const WINDOW_HOURS: AprWindow = 24;

export function PerformanceCard() {
  if (PAIR === undefined) {
    throw new Error("shared exports no pairs");
  }

  const { points } = usePairMetrics(PAIR.address);

  return (
    <section>
      <SectionHeading>Performance</SectionHeading>
      <Card className="mt-[10px] ">
        <div className="flex items-center justify-between p-[16px]">
          <div className="flex items-center gap-[4px]">
            <h3 className="text-[15px] leading-[23px] font-medium text-ink">
              {PAIR.token0Symbol}/{PAIR.token1Symbol}
            </h3>
            <IconButton label="About this chart">
              <HelpCircle />
            </IconButton>
          </div>

          <div className="flex items-center gap-[22px]">
            <IconButton label="Share">
              <Share />
            </IconButton>
            <IconButton label="Download">
              <Download />
            </IconButton>
            <IconButton label="Expand">
              <Expand />
            </IconButton>
            <IconButton label="More options">
              <MoreVertical />
            </IconButton>
          </div>
        </div>

        <hr className="border-0 border-t border-divider" />

        <div className="pt-[15px] pr-[30px] pb-[30px]  pl-[16px]">
          <div className="flex items-center gap-[6px] ">
            <span
              aria-hidden="true"
              className="size-[9px] shrink-0 rounded-full bg-accent-legend"
            />
            <span className="text-[11px] leading-[13px] text-ink-secondary">
              {WINDOW_HOURS}h APR
            </span>
          </div>

          <div className="h-[334px] mt-[40px]">
            {points === undefined ? null : <AprChart points={points} aprWindow={WINDOW_HOURS} />}
          </div>
        </div>
      </Card>
    </section>
  );
}
