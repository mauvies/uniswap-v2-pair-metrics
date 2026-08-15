import type { Ref } from "react";
import { Search } from "../icons/index.ts";

interface SearchFieldProps {
  ref?: Ref<HTMLInputElement>;
  onEscape?: () => void;
}

export function SearchField({ ref, onEscape }: SearchFieldProps) {
  return (
    <div className="flex h-[40px] w-full items-center gap-[8px] rounded-field bg-canvas pl-[13px] md:w-[351px]">
      <span className="shrink-0 text-icon-search">
        <Search />
      </span>
      <input
        ref={ref}
        type="search"
        name="search"
        aria-label="Search"
        placeholder="Search..."
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onEscape?.();
          }
        }}
        className="w-full bg-transparent pr-[13px] text-[14px] font-medium text-ink outline-none placeholder:text-ink-placeholder"
      />
    </div>
  );
}
