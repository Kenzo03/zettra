// Class lists of the Terakota Lembut design's building blocks, shared by every
// screen so buttons, fields and cards look the same everywhere.

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const buttonBase =
  "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 text-[13.5px] font-semibold no-underline transition-[color,background-color,border-color,scale] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 disabled:active:scale-100 disabled:cursor-default disabled:opacity-40";

export const button = {
  primary: `${buttonBase} bg-accent text-white shadow-[0_1px_2px_rgba(120,40,20,0.25)] hover:bg-accent-strong hover:text-white`,
  secondary: `${buttonBase} border border-line bg-white text-ink hover:bg-paper hover:text-ink`,
  danger: `${buttonBase} border border-danger-line bg-white text-danger hover:bg-danger-soft hover:text-danger`,
  // A secondary button that shows something is on, such as Filters with filters set.
  on: `${buttonBase} border border-accent bg-accent-soft text-accent-strong hover:text-accent-strong`,
  // Looks like a link, acts like a button.
  quiet: "inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-link transition-colors duration-150 hover:text-link-hover hover:underline disabled:opacity-40",
};

// A control marked aria-invalid gets a red border, so an error points at its field.
export const field = {
  input: "h-10 rounded-[10px] border border-field bg-white px-3 text-sm text-ink placeholder:text-muted disabled:opacity-50 aria-invalid:border-danger",
  compact: "h-9 rounded-[10px] border border-line bg-white px-2.5 text-[13px] text-ink aria-invalid:border-danger",
  textarea: "rounded-xl border border-field bg-white px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-muted aria-invalid:border-danger",
  label: "flex flex-col gap-1.5 text-[13px] font-semibold text-ink",
  hint: "text-xs text-muted",
  error: "text-[13px] text-danger",
};

// The one raised card a page may have. `surface-raised` carries no styles; it is
// the hook the e2e specs count. Callers add their own padding (the ticket and Home
// cards use `px-6 py-5.5`).
export const raised =
  "surface-raised rounded-[18px] border border-line bg-white shadow-[0_1px_2px_rgba(43,36,32,0.05),0_12px_32px_-8px_rgba(43,36,32,0.12)]";

// A block on the page background, divided from the one above by a line. Put actions
// at the right end of its heading with `ml-auto` on the action.
export const section = "mt-7 border-t border-line pt-4 first:mt-0 first:border-t-0 first:pt-0";
export const sectionHeading = "mb-3 flex items-center gap-2 text-sm font-extrabold";

// Label and value pairs on the page background, one ruled row each.
export const rail = {
  list: "flex flex-col text-[13.5px]",
  row: "grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 border-b border-line py-2.5 first:pt-0",
  label: "text-muted",
  value: "min-w-0 font-semibold",
};

export const chip = "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11.5px] font-semibold leading-[22px]";
// A radio or checkbox drawn as a pill; its box stays visible, so the choice reads at a glance.
export const choice =
  "flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold text-ink-soft hover:border-field has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong [&>input]:size-3.5 [&>input]:accent-accent";
export const sectionTitle = "text-[13px] font-bold text-muted";

// `relative` keeps a sr-only header inside the scroll box, so it cannot widen a phone page.
export const table = {
  wrap: `relative overflow-x-auto ${raised}`,
  // The same table with no lift, for a page whose one raised card is elsewhere.
  plain: "relative overflow-x-auto rounded-2xl border border-line bg-white",
  table: "w-full border-collapse text-left text-[13px]",
  head: "border-b border-line bg-paper text-xs text-muted",
  th: "px-3.5 py-2.5 font-semibold",
  row: "border-b border-line-soft last:border-0",
  td: "px-3.5 py-2.5 align-top",
};
