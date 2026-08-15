export function ChartSkeleton() {
  return (
    <div role="status" className="grid h-full place-items-center rounded-card bg-surface-muted/80">
      <div className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="size-[24px] animate-spin rounded-full border-2 border-border border-t-primary"
        />
        <p className="text-sm text-ink-secondary">Recalculating</p>
      </div>
    </div>
  );
}
