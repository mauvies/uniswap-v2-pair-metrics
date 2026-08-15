import { PAIRS } from "@uniswap-v2-pair-metrics/shared";
import { ChevronDown } from "../../components/icons/index.ts";

interface PairSelectProps {
  address: string;
  onChange: (address: string) => void;
}

export function PairSelect({ address, onChange }: PairSelectProps) {
  return (
    <div className="relative flex items-center text-ink">
      <select
        name="pair"
        aria-label="Pair"
        value={address}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none bg-transparent pr-[15px] text-[15px] leading-[23px] font-medium outline-none"
      >
        {PAIRS.map((pair) => (
          <option key={pair.address} value={pair.address}>
            {pair.token0Symbol}/{pair.token1Symbol}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-0 flex text-icon">
        <ChevronDown />
      </span>
    </div>
  );
}
