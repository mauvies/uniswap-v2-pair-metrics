import { PAIRS } from "@uniswap-v2-pair-metrics/shared";
import { Download, Expand, HelpCircle, MoreVertical, Share } from "../../components/icons/index.ts";
import { Card } from "../../components/ui/Card.tsx";
import { IconButton } from "../../components/ui/IconButton.tsx";

/**
 * The pair and window the card describes. Both become selector state in a later commit; the
 * defaults are the active pair and the widest APR window (§6.2).
 */
const PAIR = PAIRS[0];
const WINDOW_HOURS = 24;

export function PerformanceCard() {
  if (PAIR === undefined) {
    throw new Error("shared exports no pairs");
  }

  return (
    <Card>
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

      <div className="flex items-center gap-[6px] p-[16px]">
        <span aria-hidden="true" className="size-[9px] shrink-0 rounded-full bg-accent-legend" />
        <span className="text-[11px] leading-[13px] text-ink-secondary">{WINDOW_HOURS}h APR</span>
      </div>
    </Card>
  );
}
