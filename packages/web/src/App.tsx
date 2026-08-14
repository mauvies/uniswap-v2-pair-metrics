/**
 * A placeholder for the shell, which replaces it whole in the next commit. Every value here
 * is from docs/design-tokens.md §2.3 rather than invented, so the render is comparable
 * against the Figma.
 *
 * It earns its place by proving the theme resolves end to end: the canvas colour, Inter at
 * all four weights — 700, 500, 400, 600, one per element below — and the card's radius,
 * border, surface and shadow. A page with one heading would leave most of that unchecked.
 */
export function App() {
  return (
    <main className="min-h-dvh bg-canvas px-[105px] py-[20px]">
      <h1 className="text-[20px] font-bold text-ink-heading">Dashboard</h1>
      <h2 className="mt-[43px] text-[15px] font-medium text-ink-heading">Global Metrics</h2>
      <section className="mt-[28px] h-[70px] w-[206px] rounded-card border border-border bg-surface px-[14px] pt-[18px] shadow-card">
        <p className="text-[11px] leading-[13px] text-ink">Total Allocation</p>
        <p className="mt-[5px] text-[15px] leading-[18px] font-semibold text-ink">$2,533,557.32</p>
      </section>
    </main>
  );
}
