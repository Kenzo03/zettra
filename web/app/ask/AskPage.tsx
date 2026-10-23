"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Answer, { type Chip, type Turn } from "@/components/ask/Answer";
import AskView from "@/components/ask/AskView";
import { api } from "@/lib/api";
import { button, cx } from "@/lib/ui";

// Hides the open thread; the page puts it beside the title.
export function HideThread({ threadId }: { threadId: number }) {
  const t = useTranslations("ask");
  const router = useRouter();
  return (
    <button
      type="button"
      className={cx(button.quiet, "ml-auto")}
      onClick={async () => {
        const { error } = await api.DELETE("/ask/threads/{id}", { params: { path: { id: threadId } } });
        if (!error) {
          router.push("/ask");
          router.refresh();
        }
      }}
    >
      {t("hideThread")}
    </button>
  );
}

// The open thread: its saved answers, then the Ask box for more questions.
export default function AskPage({
  threadId,
  history,
  chips,
  question,
  examples,
}: {
  threadId?: number;
  history: Turn[];
  chips: Chip[];
  question?: string;
  examples?: string[];
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6">
      {history.length > 0 && (
        <div className="flex max-w-3xl flex-col gap-6">
          {history.map((turn, i) => (
            <Answer key={i} turn={turn} />
          ))}
        </div>
      )}
      <AskView
        chips={chips}
        threadId={threadId}
        question={question}
        examples={examples}
        onThread={() => {
          // Stay on this view, so the live answer keeps its scope and results;
          // the side list picks up the new thread. A Home question is not re-asked on reload.
          if (question) window.history.replaceState(null, "", "/ask");
          router.refresh();
        }}
      />
    </div>
  );
}
