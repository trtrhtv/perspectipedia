"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Entry } from "@/lib/types";
import EntryDisplay from "./EntryDisplay";
import { ErrorState, LoadingState, PendingReviewState, RefusedState } from "./EntryStates";

type Status =
  | "idle"
  | "creating" // POST יצא / polling רץ
  | "ready"
  | "refused"
  | "pending_review"
  | "failed"
  | "error";

const POLL_INTERVAL_MS = 2500;

// זרימת יצירת ערך (PLAN 5.1): POST מפורש → 202 → polling על GET /api/entry/[slug].
// עמיד ל-refresh ולריבוי טאבים: השרת מחזיק את המצב בשורת ה-Entry, לא הלקוח.
// GET (כולל קרולרים) לעולם לא מייצר: הדף מרנדר את הרכיב במצב idle/pending בלבד.
export default function CreateEntryFlow({
  topic,
  slug,
  initialStatus = "idle",
}: {
  topic: string;
  slug: string;
  initialStatus?: "idle" | "creating" | "failed";
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [refusalReason, setRefusalReason] = useState("");
  const stopped = useRef(false);

  const poll = useCallback(async () => {
    while (!stopped.current) {
      try {
        const res = await fetch(`/api/entry/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          if (stopped.current) return;
          if (data.status === "ready") {
            setEntry(data.entry as Entry);
            setStatus("ready");
            return;
          }
          if (data.status === "refused") {
            setRefusalReason(data.reason ?? "הנושא הזה מחוץ לתחום של perspectipedia.");
            setStatus("refused");
            return;
          }
          if (data.status === "pending_review") {
            setStatus("pending_review");
            return;
          }
          if (data.status === "failed") {
            setStatus("failed");
            return;
          }
          // pending → ממשיכים לחכות
        }
      } catch {
        // שגיאת רשת רגעית — ממשיכים לנסות
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }, [slug]);

  useEffect(() => {
    stopped.current = false;
    if (initialStatus === "creating") void poll();
    return () => {
      stopped.current = true;
    };
  }, [initialStatus, poll]);

  async function create() {
    setStatus("creating");
    setError(null);
    try {
      const res = await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 202) {
        setError({ message: data.error ?? "אירעה שגיאה.", code: data.code });
        setStatus("error");
        return;
      }
      if (data.refused) {
        setRefusalReason(data.reason ?? "הנושא הזה מחוץ לתחום של perspectipedia.");
        setStatus("refused");
        return;
      }
      if (data.pendingReview) {
        setStatus("pending_review");
        return;
      }
      if (data.entry) {
        setEntry(data.entry as Entry);
        setStatus("ready");
        return;
      }
      // pending (202) או failed שהוחיה — עוברים ל-polling.
      void poll();
    } catch {
      setError({ message: "החיבור נכשל. נסו שוב." });
      setStatus("error");
    }
  }

  if (status === "ready" && entry) return <EntryDisplay entry={entry} />;
  if (status === "creating") return <LoadingState />;
  if (status === "refused") return <RefusedState reason={refusalReason} />;
  if (status === "pending_review") return <PendingReviewState />;
  if (status === "error" && error) return <ErrorState error={error} />;
  if (status === "failed") {
    return (
      <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-medium text-amber-900">יצירת הערך נכשלה</p>
        <p className="mt-1 text-sm text-amber-800">
          משהו השתבש בדרך. אפשר לנסות שוב — לפעמים זה עניין רגעי.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={create}
            className="rounded-xl bg-accent px-5 py-2 font-medium text-white transition hover:bg-accent/90"
          >
            נסו שוב
          </button>
          <Link href="/" className="text-sm text-accent hover:underline">
            ← חזרה לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-2xl border border-line bg-white p-6">
      <p className="font-medium text-ink">הנושא הזה עוד לא נחקר</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        עוד אין לנו ערך על &quot;{topic}&quot;. אפשר לבנות אותו עכשיו — ניצור אותו מכמה נקודות
        מבט מבוססות, וזה עשוי לקחת עד כמה דקות.
      </p>
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={create}
          className="rounded-xl bg-accent px-5 py-2 font-medium text-white transition hover:bg-accent/90 active:scale-[0.98]"
        >
          בנו את הערך
        </button>
        <Link href="/" className="text-sm text-accent hover:underline">
          ← חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
