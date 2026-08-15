import {
  Logo,
  NavDashboard,
  NavDiscover,
  NavInvoices,
  NavSettings,
  NavStrategies,
  Notification,
} from "../icons/index.ts";

const NAV = [
  { label: "Dashboard", Icon: NavDashboard, current: true },
  { label: "Strategies", Icon: NavStrategies, current: false },
  { label: "Invoices", Icon: NavInvoices, current: false },
  { label: "Discover", Icon: NavDiscover, current: false },
  { label: "Settings", Icon: NavSettings, current: false },
] as const;

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[63px] shrink-0 flex-col items-center border-r border-border bg-surface md:flex">
      <div className="pt-[20px] text-primary">
        <Logo />
      </div>

      <nav aria-label="Main" className="mt-[55px] flex flex-col gap-[20px]">
        {NAV.map(({ label, Icon, current }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            aria-current={current ? "page" : undefined}
            className={`grid size-[40px] place-items-center rounded-card ${
              current ? "bg-surface-nav-active text-primary" : "text-icon-nav"
            }`}
          >
            <Icon />
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-[20px] pb-[19px]">
        <button
          type="button"
          aria-label="Notifications"
          className="grid size-[40px] place-items-center rounded-card text-icon-notification"
        >
          <Notification />
        </button>
        <button
          type="button"
          aria-label="Account"
          className="grid size-[32px] place-items-center rounded-full bg-avatar text-[14px] font-semibold text-on-accent"
        >
          <span aria-hidden="true">MS</span>
        </button>
      </div>
    </aside>
  );
}
