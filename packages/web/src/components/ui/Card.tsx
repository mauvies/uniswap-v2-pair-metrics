import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * The chrome §1.4 applies to every card in the design, metric and Performance alike. The
 * four properties are the whole component; size and padding differ per card and come from
 * the caller.
 */
export function Card({ children, className }: CardProps) {
  return (
    <div className={`rounded-card border border-border bg-surface shadow-card ${className ?? ""}`}>
      {children}
    </div>
  );
}
