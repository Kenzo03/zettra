import Link from "next/link";
import { getTranslations } from "next-intl/server";
import AutoApplyForm from "@/components/AutoApplyForm";
import { showsClients } from "@/components/Chips";
import FilterPanel from "@/components/FilterPanel";
import Icon from "@/components/Icon";
import { chips, isLit, panelKeys, viewHref, views } from "@/lib/filter-views";
import type { Client, Ref, Status } from "@/lib/problem";
import { button, cx, field } from "@/lib/ui";

type Props = {
  action: string;
  values: Record<string, string>;
  clients: Client[];
  assignees: Ref[]; // who can own tickets, so a lead can look at one person's work
  statuses?: Status[]; // the list filters by status; the board shows every status anyway
  labels?: string[]; // the project's labels, most used first (MSL-56)
  releases?: { id: number; name: string }[]; // MSL-67
};

// A filter: its URL key, its name, and its choices, the first one "any" ("").
type Filter = { key: string; label: string; options: [value: string, text: string][] };

// The id of the bar's form, for a field rendered elsewhere on the page (Sort).
export const filtersForm = (action: string) => `${action}-filters`;

// The filter bar of the board and the list (FSD §8.4, §8.5), layout D: quick
// views, search, Client and Type, then the rest under Filters, and a chip for
// each filter set there. It is a GET form that applies as it changes, so every
// view is a URL people can share.
export default async function TicketFilters({ action, values, clients, assignees, statuses, labels = [], releases = [] }: Props) {
  const t = await getTranslations("ticketFilters");
  const tTypes = await getTranslations("ticketTypes");
  const withStatus = statuses !== undefined;
  // A link from the workload page may carry another number of days.
  const staleDays = [...new Set([7, 14, 30, ...(/^\d+$/.test(values.stale ?? "") ? [Number(values.stale)] : [])])].sort((a, b) => a - b);
  const filters: Filter[] = [
    { key: "client", label: t("client"), options: [["", t("allClients")], ["core", t("core")], ...clients.map((c): [string, string] => [String(c.id), c.name])] },
    { key: "type", label: t("type"), options: [["", t("anyType")], ...(["bug", "change_request", "feature"] as const).map((ty): [string, string] => [ty, tTypes(ty)])] },
    { key: "assignee", label: t("assignee"), options: [["", t("anyone")], ["me", t("mine")], ["none", t("unassigned")], ...assignees.map((a): [string, string] => [String(a.id), a.name])] },
    { key: "status", label: t("status"), options: [["", t("anyStatus")], ["open", t("openStatuses")], ...(statuses ?? []).map((s): [string, string] => [String(s.id), s.name])] },
    { key: "due", label: t("due"), options: [["", t("anyDue")], ["overdue", t("overdue")], ["week", t("dueWeek")]] },
    { key: "accepted", label: t("accepted"), options: [["", t("anyAcceptance")], ["yes", t("acceptedYes")], ["no", t("acceptedNo")]] },
    { key: "stale", label: t("stale"), options: [["", t("anyActivity")], ...staleDays.map((d): [string, string] => [String(d), t("staleDays", { days: d })])] },
    { key: "missing", label: t("missing"), options: [["", t("nothingMissing")], ["reason", t("missingReason")], ["menus", t("missingMenus")], ["weak_reason", t("weakReason")]] },
    { key: "label", label: t("labelFilter"), options: [["", t("anyLabel")], ...labels.map((l): [string, string] => [l, l])] },
    { key: "release", label: t("release"), options: [["", t("anyRelease")], ...releases.map((r): [string, string] => [String(r.id), r.name])] },
  ];
  const byKey = new Map(filters.map((f) => [f.key, f]));
  const inPanel = panelKeys.filter((k) => (k !== "status" || withStatus) && (k !== "label" || labels.length > 0) && (k !== "release" || releases.length > 0));
  const count = panelKeys.filter((k) => values[k]).length;
  const set = chips(values, withStatus);
  const reset = <a href={action} className={button.quiet}>{t("reset")}</a>;

  // In the panel a filter is a labelled field. Client and Type are chips in the
  // row from md up, and fields in the panel below it.
  const select = (f: Filter, chip = false) => (
    <label
      key={f.key}
      htmlFor={`${action}-${f.key}`}
      className={cx(
        field.label,
        "min-w-0",
        chip && "md:h-9 md:flex-row md:items-center md:gap-1 md:rounded-[10px] md:border md:border-line md:bg-white md:pl-3 md:text-[13.5px] md:focus-within:border-accent",
      )}
    >
      {f.label}
      <select
        id={`${action}-${f.key}`}
        name={f.key}
        defaultValue={values[f.key] ?? ""}
        className={cx(
          field.compact,
          "w-full",
          chip && "md:h-full md:w-auto md:field-sizing-content md:cursor-pointer md:border-0 md:bg-transparent md:px-0 md:text-[13.5px] md:font-medium md:text-muted md:outline-none",
        )}
      >
        {f.options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
    </label>
  );
  const picks = (showsClients(clients) ? ["client", "type"] : ["type"]).map((k) => select(byKey.get(k)!, true));

  return (
    <AutoApplyForm id={filtersForm(action)} action={action} values={values} aria-label={t("label")} className="mt-1 flex w-full flex-col gap-2.5">
      <div className="relative flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("views")} className="mr-1.5 flex max-w-full gap-0.5 overflow-x-auto rounded-[11px] bg-well p-[3px]">
          {views(withStatus).map((v) => {
            const lit = isLit(values, v);
            return (
              <Link
                key={v.id}
                href={viewHref(action, values, v)}
                aria-current={lit ? "true" : undefined}
                className={cx(
                  "flex h-[30px] shrink-0 items-center rounded-lg px-3 text-[13px] no-underline",
                  lit ? "bg-white font-bold text-ink shadow-[0_1px_2px_rgba(43,36,32,0.1)] hover:text-ink" : "font-semibold text-ink-soft hover:text-ink",
                )}
              >
                {t(({ open: "openStatuses", mine: "mine", overdue: "overdue", unassigned: "unassigned", anyStatus: "anyStatus" } as const)[v.id])}
              </Link>
            );
          })}
        </div>
        <label className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-white px-3 text-muted focus-within:border-accent">
          <Icon name="search" />
          <input name="q" defaultValue={values.q} aria-label={t("q")} placeholder={t("qPlaceholder")} className="w-40 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-muted" />
        </label>
        <FilterPanel count={count} narrowCount={count + ["client", "type"].filter((k) => values[k]).length} picks={picks} footer={reset}>
          {inPanel.map((k) => select(byKey.get(k)!))}
        </FilterPanel>
      </div>
      {set.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {set.map((k) => {
            const f = byKey.get(k)!;
            const text = f.options.find(([v]) => v === values[k])?.[1] ?? values[k];
            return (
              <span key={k} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-white pl-2.5 pr-1 text-[12.5px]">
                <span className="text-muted">{f.label}</span>
                <span className="font-semibold text-ink">{text}</span>
                <Link
                  href={viewHref(action, values, { param: k, value: "" })}
                  aria-label={t("remove", { label: f.label })}
                  className="flex size-5 items-center justify-center rounded-full text-muted no-underline hover:bg-well hover:text-ink"
                >
                  ×
                </Link>
              </span>
            );
          })}
          {reset}
        </div>
      )}
    </AutoApplyForm>
  );
}

// The list's Sort, above the table; it belongs to the bar's form, so it applies
// like the filters and they keep it.
export async function TicketSort({ action, value }: { action: string; value?: string }) {
  const t = await getTranslations("ticketFilters");
  return (
    <label htmlFor={`${action}-sort`} className="ml-auto flex h-9 items-center gap-1 pl-3 text-[13.5px] font-semibold text-ink">
      {t("sort")}
      <select
        id={`${action}-sort`}
        name="sort"
        form={filtersForm(action)}
        defaultValue={value ?? "updated"}
        className="h-full cursor-pointer rounded-[10px] bg-transparent text-[13.5px] font-medium text-muted outline-none"
      >
        <option value="updated">{t("sortUpdated")}</option>
        <option value="created">{t("sortCreated")}</option>
        <option value="key">{t("sortKey")}</option>
        <option value="priority">{t("sortPriority")}</option>
        <option value="due">{t("sortDue")}</option>
      </select>
    </label>
  );
}
