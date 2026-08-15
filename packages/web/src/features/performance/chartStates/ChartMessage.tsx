import type { ReactNode } from "react";

export function ChartMessage({ children }: { children: ReactNode }) {
  return <div className="grid h-full place-items-center px-[16px] text-center">{children}</div>;
}
