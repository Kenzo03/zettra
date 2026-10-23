// The quick views of the ticket list and the Board's filter bar. Each view sets
// one existing filter and keeps the others, so it is a shortcut, not a new filter.
export type View = { id: "open" | "mine" | "overdue" | "unassigned" | "anyStatus"; param: "status" | "assignee" | "due"; value: string };

const all: View[] = [
  { id: "open", param: "status", value: "open" },
  { id: "mine", param: "assignee", value: "me" },
  { id: "overdue", param: "due", value: "overdue" },
  { id: "unassigned", param: "assignee", value: "none" },
  { id: "anyStatus", param: "status", value: "" }, // clears the status
];

/** The views in bar order; the Board filters no status, so it has no status views. */
export const views = (withStatus: boolean): View[] => all.filter((v) => withStatus || v.param !== "status");

/** The URL with `v.param` set to `v.value` (cleared when empty), every other filter kept, and no cursor. */
export function viewHref(action: string, values: Record<string, string>, v: { param: string; value: string }): string {
  const q = new URLSearchParams(values);
  q.delete("cursor");
  if (v.value) q.set(v.param, v.value);
  else q.delete(v.param);
  const qs = q.toString();
  return qs ? `${action}?${qs}` : action;
}

export const isLit = (values: Record<string, string>, v: View): boolean => (values[v.param] ?? "") === v.value;

/** The filters that live in the Filters panel, in its order. */
export const panelKeys = ["assignee", "status", "due", "accepted", "stale", "missing", "label", "release"];

/** The panel filters that are set and that no lit view already shows, each one a chip. */
export const chips = (values: Record<string, string>, withStatus: boolean): string[] =>
  panelKeys.filter((k) => values[k] && !views(withStatus).some((v) => v.param === k && isLit(values, v)));
