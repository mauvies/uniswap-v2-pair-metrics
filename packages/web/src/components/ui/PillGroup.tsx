export interface PillOption<T extends string | number> {
  value: T;
  label: string;
}

interface PillGroupProps<T extends string | number> {
  label: string;
  options: readonly PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function PillGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: PillGroupProps<T>) {
  return (
    <fieldset aria-label={label} className="flex gap-[3px]">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`h-[22px] rounded-pill border px-[8px] text-[11px] tracking-[0.12px] text-ink-secondary ${
              selected
                ? "border-border-selected bg-surface-selected"
                : "border-transparent bg-surface-muted"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
