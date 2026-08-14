import { useEffect, useId, useRef, useState } from "react";
import { Close, Search } from "../icons/index.ts";
import { SearchField } from "../ui/SearchField.tsx";

export function TopBar() {
  const [open, setOpen] = useState(false);
  const overlayId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Focus goes back to the control that opened the overlay, or it lands on the document and
  // the next tab starts from the top of the page.
  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <header className="relative flex h-[64px] shrink-0 items-center justify-between border-b border-border bg-surface px-[16px] md:pr-[48px] md:pl-[42px]">
      <h1 className="text-[20px] font-bold text-ink-heading">Dashboard</h1>

      <div className="hidden md:block">
        <SearchField />
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-label="Search"
        aria-expanded={open}
        aria-controls={overlayId}
        onClick={() => setOpen(true)}
        className="grid size-[40px] shrink-0 place-items-center rounded-field text-icon-search [&>svg]:size-[20px] md:hidden"
      >
        <Search />
      </button>

      {open && (
        <div
          id={overlayId}
          className="absolute inset-0 flex items-center gap-[8px] bg-surface px-[16px] md:hidden"
        >
          <SearchField ref={inputRef} onEscape={close} />
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="grid size-[40px] shrink-0 place-items-center rounded-field text-icon"
          >
            <Close />
          </button>
        </div>
      )}
    </header>
  );
}
