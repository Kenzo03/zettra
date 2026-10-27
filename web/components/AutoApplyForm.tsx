"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "method" | "onSubmit" | "onChange"> & {
  action: string;
  values: Record<string, string>; // the URL's filters, which the fields follow
};

// AutoApplyForm is the filter bar's GET form, applied as it changes: a select
// at once, the search box after half a second without typing (or on Enter).
// It replaces the URL in place, so the page keeps its focus and scroll, and
// the view stays a URL people can share.
export default function AutoApplyForm({ action, values, children, ...props }: Props) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const typing = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(typing.current), []);

  function apply(f: HTMLFormElement) {
    clearTimeout(typing.current);
    const query = new URLSearchParams();
    for (const [name, value] of new FormData(f)) {
      if (typeof value === "string" && value !== "") query.append(name, value);
    }
    const qs = query.toString();
    router.replace(qs ? `${action}?${qs}` : action, { scroll: false });
  }

  // A select tied to the form from elsewhere on the page (form="…", the list's
  // Sort) applies too; its change event never reaches the form. The listener
  // is bound once, so it reads the latest apply (and so the latest action) through a ref.
  const latest = useRef(apply);
  useEffect(() => {
    latest.current = apply;
  });
  useEffect(() => {
    const onChange = (e: Event) => {
      const f = form.current;
      if (f && e.target instanceof HTMLSelectElement && e.target.form === f && !f.contains(e.target)) latest.current(f);
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  // The fields follow the URL, so a view or a chip that changes it changes the
  // pick that shows it too, and the next change keeps it. The field in use
  // keeps what is being typed.
  const url = new URLSearchParams(values).toString();
  useEffect(() => {
    const query = new URLSearchParams(url);
    for (const el of form.current?.elements ?? []) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || !el.name || el === document.activeElement) continue;
      el.value = query.get(el.name) ?? "";
      if (el instanceof HTMLSelectElement && el.selectedIndex < 0) el.selectedIndex = 0; // Sort has no empty choice
    }
  }, [url]);

  return (
    <form
      ref={form}
      method="get"
      action={action}
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      onChange={(e) => {
        const field = e.target;
        if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement) || !field.name) return;
        const f = e.currentTarget;
        if (field instanceof HTMLInputElement && field.type === "text") {
          clearTimeout(typing.current);
          typing.current = setTimeout(() => apply(f), 500);
        } else {
          apply(f);
        }
      }}
    >
      {children}
    </form>
  );
}
