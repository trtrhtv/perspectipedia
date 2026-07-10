"use client";

import Link from "next/link";
import { useState } from "react";
import type { Entry } from "@/lib/types";
import EntryDisplay from "./EntryDisplay";
import { ErrorState, LoadingState, PendingReviewState, RefusedState } from "./EntryStates";

type Status = "idle" | "creating" | "ready" | "refused" | "pending_review" | "error";

// זרימת יצירת ערך חדש — POST יוצא רק מלחיצה מפורשת על הכפתור.
// GET (כולל קרולרים) לעולם לא מייצר: הדף מרנדר את הרכיב הזה במצב idle בלבד.
export default function CreateEntryFlow({ topic }: { topic: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [refusalReason, setRefusalReason] = useState("");

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
      if (!res.ok) {
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
      setEntry(data.entry as Entry);
      setStatus("ready");
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
