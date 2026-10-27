"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTimeZone, useTranslations } from "next-intl";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useProblemText, type DecisionRecord } from "@/lib/problem";
import { button, chip, cx, field, raised } from "@/lib/ui";
import { useEditing } from "./TicketLive";

// The decision record on the ticket page (FSD §8.6, §9): what changed, why and
// what was rejected. Project admins and the confirmer reword a confirmed record
// (R-DC-5); a reopened ticket's record is a draft until the next close (R-DC-6).
export default function DecisionCard({ ticketKey, decision, canEdit }: { ticketKey: string; decision: DecisionRecord; canEdit: boolean }) {
  const t = useTranslations("decision");
  const locale = useLocale();
  const timeZone = useTimeZone();
  const router = useRouter();
  const problemText = useProblemText();
  const [editing, setEditing] = useState(false);
  useEditing(editing);
  const [error, setError] = useState("");
  const confirmed = decision.state === "confirmed";
  const implemented = decision.outcome === "implemented";
  const whatLabel = implemented ? t("whatChanged") : t("whatDecided");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { error } = await api.PUT("/tickets/{key}/decision", {
      params: { path: { key: ticketKey } },
      body: { what_changed: String(form.get("what_changed")), why: String(form.get("why")), alternatives: String(form.get("alternatives")) },
    });
    if (error) return setError(problemText(error));
    setEditing(false);
    setError("");
    router.refresh();
  }

  const label = "text-[12.5px] font-semibold text-muted";
  return (
    <section aria-labelledby="decision-title" className={cx(raised, "px-6 py-5.5")}>
      <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px]">
        <h2 id="decision-title" className="text-[15px] font-extrabold">{t("title")}</h2>
        <span className={cx(chip, implemented ? "bg-ok-soft text-ok" : "bg-well text-ink-soft")}>{implemented ? t("implemented") : t("rejected")}</span>
        <span className="text-muted">
          {confirmed && decision.confirmed_by && decision.confirmed_at
            ? t("confirmedBy", { name: decision.confirmed_by.name, at: dateTime(decision.confirmed_at, locale, timeZone) })
            : t("draft")}
        </span>
        {confirmed && canEdit && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={cx(button.quiet, "ml-auto")}>
            <Icon name="edit" className="size-3.5" />
            {t("edit")}
          </button>
        )}
      </div>
      {decision.superseded_by && (
        <p className="mb-3.5 flex items-center gap-2 rounded-xl border border-warn-line bg-warn-soft px-3.5 py-2.5 text-[13px] font-medium text-warn">
          <Icon name="warning" />
          {t.rich("supersededBy", { key: decision.superseded_by, link: (chunks) => <Link href={`/t/${decision.superseded_by}`} className="font-bold">{chunks}</Link> })}
        </p>
      )}
      {editing ? (
        <form onSubmit={save} aria-label={t("editTitle")} className="flex flex-col gap-3">
          <label className={field.label}>
            {whatLabel}
            <textarea name="what_changed" defaultValue={decision.what_changed} required minLength={10} maxLength={1000} rows={2} className={field.textarea} />
          </label>
          <label className={field.label}>
            {t("why")}
            <textarea name="why" defaultValue={decision.why} required minLength={10} maxLength={2000} rows={3} className={field.textarea} />
          </label>
          <label className={field.label}>
            {t("alternatives")}
            <textarea name="alternatives" defaultValue={decision.alternatives} maxLength={2000} rows={2} className={field.textarea} />
          </label>
          {error && <p role="alert" className={field.error}>{error}</p>}
          <div className="flex gap-2">
            <button className={button.primary}>{t("save")}</button>
            <button type="button" onClick={() => setEditing(false)} className={button.secondary}>{t("cancel")}</button>
          </div>
        </form>
      ) : (
        // What changed leads; why and the rejected alternatives sit side by side under a thin line.
        <dl className="grid gap-y-3.5 md:grid-cols-2">
          <div className="min-w-0 md:col-span-2">
            <dt className={label}>{whatLabel}</dt>
            <dd className="mb-1 mt-1 whitespace-pre-wrap break-words text-[20px] font-bold leading-[1.4] tracking-[-0.01em] [text-wrap:pretty]">{decision.what_changed || "—"}</dd>
          </div>
          <div className="min-w-0 border-t border-line-soft pt-3.5 md:pr-3.5">
            <dt className={label}>{t("why")}</dt>
            <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-[1.55] text-ink-soft">{decision.why || "—"}</dd>
          </div>
          <div className="min-w-0 border-t border-line-soft pt-3.5 md:pl-3.5">
            <dt className={label}>{t("alternatives")}</dt>
            <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-[1.55] text-ink-soft">{decision.alternatives || "—"}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
