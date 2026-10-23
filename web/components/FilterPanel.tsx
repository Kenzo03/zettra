"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/Icon";
import { button } from "@/lib/ui";

type Props = {
  count: number; // filters set inside the panel
  narrowCount: number; // the same below md, where the picks move in too
  picks: React.ReactNode; // Client and Type: in the row, or in the panel below md
  footer: React.ReactNode;
  children: React.ReactNode; // the panel's selects
};

const md = "(min-width: 48rem)";
const subscribe = (change: () => void) => {
  const m = matchMedia(md);
  m.addEventListener("change", change);
  return () => m.removeEventListener("change", change);
};

// The filter bar's "Filters" button and the panel it opens. The panel floats
// under the bar's row (its containing block) and stays in the form while
// closed, so its selects still apply; Escape or a click outside closes it.
export default function FilterPanel({ count, narrowCount, picks, footer, children }: Props) {
  const t = useTranslations("ticketFilters");
  const id = useId();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // The server draws the wide layout; a phone moves the picks in once it runs.
  const wide = useSyncExternalStore(subscribe, () => matchMedia(md).matches, () => true);
  // It opens under the button, held inside the row: the row wraps, so the
  // button is not always at its right end.
  useLayoutEffect(() => {
    const p = panel.current;
    const b = toggle.current;
    if (!open || !p || !b || !(p.offsetParent instanceof HTMLElement)) return;
    p.style.left = `${Math.max(0, Math.min(b.offsetLeft, p.offsetParent.clientWidth - p.offsetWidth))}px`;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const at = e.target as Node;
      if (!panel.current?.contains(at) && !toggle.current?.contains(at)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const set = wide ? count : narrowCount;
  return (
    <>
      {wide && <div className="hidden md:contents">{picks}</div>}
      <button ref={toggle} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className={set > 0 ? button.on : button.secondary}>
        <Icon name="sliders" />
        {set > 0 ? t("filtersSet", { count: set }) : t("filters")}
      </button>
      <div
        ref={panel}
        id={id}
        hidden={!open}
        className="@container absolute left-0 top-full z-30 mt-2 w-[37.5rem] max-w-full rounded-2xl border border-line bg-white p-4 shadow-[0_12px_32px_rgba(43,36,32,0.12),0_2px_6px_rgba(43,36,32,0.06)]"
      >
        {/* Three columns when the panel has the room, two when the page is narrow. */}
        <div className="grid grid-cols-2 gap-3 @min-[34rem]:grid-cols-3">
          {!wide && picks}
          {children}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">{footer}</div>
      </div>
    </>
  );
}
