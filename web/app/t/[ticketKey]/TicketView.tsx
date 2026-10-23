"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTimeZone, useTranslations } from "next-intl";
import { Avatar, ClientChip, PriorityChip, StatusDot, TypeIcon, showsClients } from "@/components/Chips";
import CloseDialog from "@/components/CloseDialog";
import Icon from "@/components/Icon";
import Markdown from "@/components/Markdown";
import PageBar from "@/components/PageBar";
import TicketForm from "@/components/TicketForm";
import { api } from "@/lib/api";
import { dateTime, day } from "@/lib/format";
import { nodePaths } from "@/lib/nodes";
import { useProblemText, type Client, type Node, type Ref, type Status, type Ticket } from "@/lib/problem";
import { button, cx, field, raised, rail, section, sectionHeading } from "@/lib/ui";
import Acceptance from "./Acceptance";
import Code from "./Code";
import DecisionCard from "./DecisionCard";
import { useEditing } from "./TicketLive";
import Links from "./Links";
import type { Person } from "@/lib/mentions";
import { updateBody } from "@/lib/bulk";
import { toggleTask } from "@/lib/tasks";

type Props = {
  ticket: Ticket;
  statuses: Status[];
  clients: Client[];
  nodes: Node[];
  assignees: Ref[];
  canEdit: boolean;
  canEditDecision: boolean; // project admin or the record's confirmer (R-DC-5)
  activity: React.ReactNode;
  attachments: React.ReactNode;
  people: Person[]; // their @handles show as names (MSL-30)
};

const closing = (s: Status) => s.category === "done" || s.category === "cancelled";

export default function TicketView({ ticket, statuses, clients, nodes, assignees, canEdit, canEditDecision, activity, attachments, people }: Props) {
  const t = useTranslations("ticket");
  const tp = useTranslations("project");
  const ta = useTranslations("ask");
  const tTypes = useTranslations("ticketTypes");
  const tPri = useTranslations("priorities");
  const tf = useTranslations("ticketForm");
  const [taskError, setTaskError] = useState("");
  const [following, setFollowing] = useState(Boolean(ticket.following));
  async function toggleFollow() {
    const path = { params: { path: { key: ticket.key } } };
    const { error } = following ? await api.DELETE("/tickets/{key}/follow", path) : await api.POST("/tickets/{key}/follow", path);
    if (!error) setFollowing(!following);
  }
  // MSL-55: a ticked step saves the description, through the same update as an edit.
  async function tickTask(line: number, checked: boolean) {
    const description = toggleTask(ticket.description, line, checked);
    if (description === ticket.description) return;
    const { error } = await api.PUT("/tickets/{key}", {
      params: { path: { key: ticket.key }, header: { "If-Match": `"${ticket.version}"` } },
      body: { ...updateBody(ticket, {}), description },
    });
    setTaskError(error ? problemText(error) : "");
    if (!error) router.refresh();
  }
  const locale = useLocale();
  const timeZone = useTimeZone();
  const problemText = useProblemText();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [closingTo, setClosingTo] = useState<Status | null>(null);
  useEditing(editing || closingTo !== null);
  const pathOf = useMemo(() => nodePaths(nodes), [nodes]);

  // Open moves go straight through; Done and Cancelled open the close dialog (FSD §9.1).
  async function transition(statusId: number) {
    const target = statuses.find((s) => s.id === statusId);
    if (!target || target.id === ticket.status.id) return;
    if (closing(target)) return setClosingTo(target);
    const { error } = await api.POST("/tickets/{key}/transition", {
      params: { path: { key: ticket.key } },
      body: { status_id: statusId },
    });
    if (error) return setError(problemText(error));
    setError("");
    router.refresh();
  }

  const person = "size-6 bg-accent-soft text-[10px] font-bold text-accent-strong";
  // One raised card a page: the decision record once the ticket has one, else the Reason.
  const raiseReason = !ticket.decision;
  return (
    <>
      <PageBar>
        <nav aria-label={t("path")} className="flex items-center gap-1.5 text-[13px] text-muted">
          <Link href={`/p/${ticket.project_key}/board`}>{ticket.project_key}</Link>
          <Icon name="chevronRight" className="size-3.5" />
          <Link href={`/p/${ticket.project_key}/tickets`}>{tp("tickets")}</Link>
        </nav>
        <Link href={askAbout(ticket)} className={cx(button.secondary, "ml-auto")}>
          <Icon name="sparkle" className="size-4 text-accent" />
          {ta("askAboutTicket")}
        </Link>
        {/* MSL-57: anyone who can see the ticket follows it to hear its comments and status. */}
        <button type="button" onClick={toggleFollow} aria-pressed={following} className={button.secondary}>
          <Icon name="bell" className={following ? "size-4 text-accent" : "size-4"} />
          {following ? t("following") : t("follow")}
        </button>
        {canEdit && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={button.secondary}>
            <Icon name="edit" />
            {t("edit")}
          </button>
        )}
      </PageBar>
      <main className="flex flex-col gap-4 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-ink-soft">
            <span className="font-bold text-muted">{ticket.key}</span>
            <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-white pl-3.5 shadow-[0_1px_2px_rgba(43,36,32,0.04)] focus-within:border-accent">
              <StatusDot color={ticket.status.color} />
              <span className="sr-only">{t("status")}</span>
              <select
                value={ticket.status.id}
                disabled={!canEdit}
                onChange={(e) => transition(Number(e.target.value))}
                className="h-full cursor-pointer rounded-full bg-transparent text-[13.5px] font-bold text-ink outline-none disabled:cursor-default"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <span className="flex items-center gap-1.5 font-semibold">
              <TypeIcon type={ticket.type} label={tTypes(ticket.type)} />
              {tTypes(ticket.type)}
            </span>
            {showsClients(clients) && <ClientChip client={ticket.client} coreLabel={t("core")} />}
            {(ticket.priority === "high" || ticket.priority === "urgent") && <PriorityChip priority={ticket.priority} label={tPri(ticket.priority)} />}
          </div>
          <h1 className="max-w-[24ch] break-words text-[34px] font-extrabold leading-[1.12] tracking-[-0.025em] [text-wrap:pretty]">{ticket.title}</h1>
        </div>
        {error && <p role="alert" className={field.error}>{error}</p>}
        {!closing(ticket.status) && (!ticket.reason || ticket.nodes.length === 0) && (
          <p className="flex items-center gap-2 rounded-xl border border-warn-line bg-warn-soft px-3.5 py-2.5 text-[13px] font-medium text-warn">
            <Icon name="warning" />
            {t("missingClose")}
          </p>
        )}
        {editing ? (
          <div className={raised}>
            <TicketForm
              projectKey={ticket.project_key}
              ticket={ticket}
              clients={clients}
              nodes={nodes}
              assignees={assignees}
              onSaved={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="grid items-start gap-11 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <section aria-labelledby="reason-title" className={raiseReason ? cx(raised, "px-6 py-5.5") : "mb-5 max-w-[64ch]"}>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[12.5px] text-muted">
                  <h2 id="reason-title" className="font-semibold">{t("reason")}</h2>
                  <span>
                    {t("requestedBy")} {ticket.requester.name}{ticket.requester.title ? ` (${ticket.requester.title})` : ""}
                  </span>
                </div>
                {ticket.reason ? (
                  <p className={cx("whitespace-pre-wrap [text-wrap:pretty]", raiseReason ? "text-[19px] font-bold leading-[1.4] tracking-[-0.01em]" : "text-[18px] font-medium leading-normal")}>{ticket.reason}</p>
                ) : (
                  <p className={cx("text-muted", raiseReason ? "text-[19px] font-bold" : "text-[18px] font-medium")}>{t("none")}</p>
                )}
              </section>
              {ticket.decision && <DecisionCard ticketKey={ticket.key} decision={ticket.decision} canEdit={canEditDecision} />}
              <section aria-label={t("details")} className={section}>
                <section aria-labelledby="menus-title" className={section}>
                  <h2 id="menus-title" className={sectionHeading}>{t("menus")}</h2>
                  {ticket.nodes.length === 0 ? (
                    <p className="text-sm text-muted">{t("none")}</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {ticket.nodes.map((n) => (
                        <li key={n.id} className="min-w-0">
                          <Link
                            href={`/p/${ticket.project_key}/modules/${n.id}`}
                            title={pathOf(n.id) || n.name}
                            className="inline-flex h-8 max-w-full items-center gap-2 rounded-[10px] bg-well px-3 text-[13.5px] font-semibold text-ink no-underline hover:bg-line-soft hover:text-ink"
                          >
                            <Icon name="screen" className="size-3.5 shrink-0 text-muted" />
                            <span className="truncate">{pathOf(n.id) || n.name}</span>
                            {n.archived ? ` (${t("archived")})` : ""}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section aria-labelledby="description-title" className={section}>
                  <h2 id="description-title" className={sectionHeading}>{t("description")}</h2>
                  {ticket.description ? (
                    <Markdown text={ticket.description} people={people} onTask={canEdit ? tickTask : undefined} />
                  ) : (
                    <p className="text-sm text-muted">{t("none")}</p>
                  )}
                  {taskError && <p role="alert" className="mt-2 text-xs text-danger">{taskError}</p>}
                </section>
              </section>
              <Links ticketKey={ticket.key} links={ticket.links} canEdit={canEdit} />
              {ticket.code && <Code code={ticket.code} />}
              {activity}
            </div>
            <aside className="min-w-0">
              <section aria-label={t("people")} className={section}>
                <dl className={rail.list}>
                  <div className={rail.row}>
                    <dt className={rail.label}>{t("requestedBy")}</dt>
                    <dd className={cx(rail.value, "flex items-center gap-2")}>
                      <Avatar name={ticket.requester.name} className={person} />
                      <span className="min-w-0">
                        <span className="block truncate" title={ticket.requester.name}>{ticket.requester.name}</span>
                        {ticket.requester.title && <span className="block truncate text-xs font-medium text-muted" title={ticket.requester.title}>{ticket.requester.title}</span>}
                      </span>
                    </dd>
                  </div>
                  <div className={rail.row}>
                    <dt className={rail.label}>{t("reporter")}</dt>
                    <dd className={cx(rail.value, "flex items-center gap-2")}>
                      <Avatar name={ticket.reporter.name} className={person} />
                      <span className="truncate" title={ticket.reporter.name}>{ticket.reporter.name}</span>
                    </dd>
                  </div>
                  <div className={rail.row}>
                    <dt className={rail.label}>{t("assignee")}</dt>
                    <dd className={cx(rail.value, "flex items-center gap-2")}>
                      {ticket.assignee ? (
                        <>
                          <Avatar name={ticket.assignee.name} className={person} />
                          <span className="truncate" title={ticket.assignee.name}>{ticket.assignee.name}</span>
                        </>
                      ) : (
                        <span className="font-medium text-muted">{t("nobody")}</span>
                      )}
                    </dd>
                  </div>
                  <div className={rail.row}>
                    <dt className={rail.label}>{tf("priority")}</dt>
                    <dd className={rail.value}>
                      <PriorityChip priority={ticket.priority} label={tPri(ticket.priority)} />
                    </dd>
                  </div>
                  {ticket.due_date && (
                    <div className={rail.row}>
                      <dt className={rail.label}>{t("due")}</dt>
                      <dd className={rail.value}>{day(ticket.due_date, locale)}</dd>
                    </div>
                  )}
                  {(ticket.labels?.length ?? 0) > 0 && (
                    <div className={rail.row}>
                      <dt className={rail.label}>{t("labels")}</dt>
                      <dd className={cx(rail.value, "flex flex-wrap gap-1")}>
                        {ticket.labels!.map((l) => (
                          <a key={l} href={`/p/${ticket.project_key}/tickets?label=${encodeURIComponent(l)}`} className="max-w-full truncate rounded-full bg-well px-2 text-xs font-semibold text-ink-soft no-underline hover:text-ink" title={l}>
                            {l}
                          </a>
                        ))}
                      </dd>
                    </div>
                  )}
                  {ticket.release && (
                    <div className={rail.row}>
                      <dt className={rail.label}>{t("release")}</dt>
                      <dd className={rail.value}>
                        <a href={`/p/${ticket.project_key}/tickets?release=${ticket.release.id}`} className="block truncate" title={ticket.release.name}>{ticket.release.name}</a>
                      </dd>
                    </div>
                  )}
                  {ticket.estimate_hours != null && (
                    <div className={rail.row}>
                      <dt className={rail.label}>{t("estimate")}</dt>
                      <dd className={rail.value}>{t("hours", { hours: ticket.estimate_hours })}</dd>
                    </div>
                  )}
                  <div className={rail.row}>
                    <dt className={rail.label}>{t("created")}</dt>
                    <dd className={rail.value}>{dateTime(ticket.created_at, locale, timeZone)}</dd>
                  </div>
                  {ticket.closed_at && (
                    <div className={rail.row}>
                      <dt className={rail.label}>{t("closed")}</dt>
                      <dd className={rail.value}>{dateTime(ticket.closed_at, locale, timeZone)}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-2.5 text-xs text-muted">
                  {t("updated")} {dateTime(ticket.updated_at, locale, timeZone)}
                </p>
              </section>
              <Acceptance ticket={ticket} canEdit={canEdit} />
              {attachments}
            </aside>
          </div>
        )}
        {closingTo && (
          <CloseDialog
            ticket={ticket}
            status={closingTo}
            nodes={nodes}
            onDone={() => {
              setClosingTo(null);
              router.refresh();
            }}
            onCancel={() => setClosingTo(null)}
          />
        )}
      </main>
    </>
  );
}

// "Ask about this ticket" (FSD §10.1): the Ask page preset to the ticket's
// project, menus and client.
function askAbout(ticket: Ticket) {
  const q = new URLSearchParams({ project: ticket.project_key });
  for (const n of ticket.nodes) q.append("node", String(n.id));
  if (ticket.client) q.set("client", String(ticket.client.id));
  return `/ask?${q}`;
}
