import type { ReactNode } from "react";

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-[15px] leading-[18px] font-medium text-ink-heading">{children}</h2>;
}
