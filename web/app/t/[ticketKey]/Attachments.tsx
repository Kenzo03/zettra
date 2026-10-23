"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { fileSize } from "@/lib/format";
import { useProblemText, type Ticket } from "@/lib/problem";
import { button, cx, field, section, sectionHeading } from "@/lib/ui";

type Props = { ticketKey: string; files: Ticket["attachments"]; meId: number; isProjectAdmin: boolean; canUpload: boolean };

// A ticket's files (FSD §8.7). Go serves each download after the ticket's visibility check.
export default function Attachments({ ticketKey, files, meId, isProjectAdmin, canUpload }: Props) {
  const t = useTranslations("attachments");
  const problemText = useProblemText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    // openapi-fetch sends JSON, so the multipart upload uses fetch directly (same origin, same cookie).
    const res = await fetch(`/api/v1/tickets/${encodeURIComponent(ticketKey)}/attachments`, { method: "POST", body: form });
    setBusy(false);
    input.value = "";
    if (!res.ok) return setError(problemText(await res.json().catch(() => undefined)));
    setError("");
    router.refresh();
  }

  async function remove(id: number) {
    const { error } = await api.DELETE("/attachments/{id}", { params: { path: { id } } });
    if (error) return setError(problemText(error));
    router.refresh();
  }

  return (
    <section aria-labelledby="attachments-title" className={section}>
      <h2 id="attachments-title" className={sectionHeading}>{t("title")}</h2>
      {files.length === 0 ? (
        <p className="text-[13px] text-muted">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5 text-[13px]">
          {files.map((f) => (
            <li key={f.id} className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-well text-[10.5px] font-bold text-ink-soft">
                {extension(f.filename) || <Icon name="file" className="size-4" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <a href={`/api/v1/attachments/${f.id}`} title={f.filename} className="truncate font-semibold leading-snug">{f.filename}</a>
                <span className="text-xs text-muted">{fileSize(f.size_bytes)}</span>
              </span>
              {canUpload && (f.uploader.id === meId || isProjectAdmin) && (
                <button type="button" onClick={() => remove(f.id)} className={cx(button.quiet, "shrink-0 text-xs")}>{t("remove")}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <label
          className={cx(
            "mt-3 flex cursor-pointer flex-row items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-field bg-paper px-3 py-2.5 text-[13.5px] font-semibold text-ink hover:border-accent focus-within:border-accent",
            busy && "opacity-40",
          )}
        >
          <span className="flex size-[30px] items-center justify-center rounded-full bg-white text-accent shadow-[0_1px_2px_rgba(43,36,32,0.1)]">
            <Icon name="upload" />
          </span>
          {t("upload")}
          <input type="file" onChange={upload} disabled={busy} className="sr-only" />
        </label>
      )}
      <p className={cx(field.hint, "mt-2")}>{t("limit")}</p>
      {error && <p role="alert" className={cx(field.error, "mt-2")}>{error}</p>}
    </section>
  );
}

// The tag on a file: its extension in lower case, empty for a name without one.
const extension = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");
