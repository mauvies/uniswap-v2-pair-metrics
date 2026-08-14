import type { ReactNode } from "react";

interface IconButtonProps {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-[18px] shrink-0 place-items-center text-icon"
    >
      {children}
    </button>
  );
}
