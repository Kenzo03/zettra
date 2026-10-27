import { cx } from "@/lib/ui";

type Option<K> = { key: K; label: string; count: number };

// Segmented status filters over a list, each with its count (the admin
// screens). Pressed buttons, not tabs: they filter one table, they don't switch panes.
// The group scrolls sideways when a phone is too narrow for it, so the focus ring sits inside each button.
export default function FilterTabs<K extends string>({ label, value, options, onChange }: { label: string; value: K; options: Option<K>[]; onChange: (key: K) => void }) {
  return (
    <div role="group" aria-label={label} className="flex max-w-full gap-0.5 overflow-x-auto rounded-[11px] bg-[#F0EAE3] p-[3px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
          className={cx(
            "inline-flex h-[30px] items-center gap-1.5 rounded-lg px-3 text-[13px] transition-colors duration-150 focus-visible:-outline-offset-2",
            o.key === value ? "bg-white font-bold text-ink shadow-[0_1px_2px_rgba(43,36,32,0.1)]" : "font-semibold text-ink-soft hover:text-ink",
          )}
        >
          {o.label}
          <span className="text-xs font-bold text-muted">{o.count}</span>
        </button>
      ))}
    </div>
  );
}
