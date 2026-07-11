"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Entry } from "@/lib/types";
import EntryDisplay from "./EntryDisplay";
import {
  ErrorState,
  FailedState,
  LoadingState,
  PendingReviewState,
  RefusedState,
} from "./EntryStates";

type Status =
  | "idle"
  | "creating" // POST יצא / polling רץ
  | "ready"
  | "refused"
  | "pending_review"
  | "failed"
  | "error";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS = 10 * 60 * 1000; // תקרה — אחריה מציגים failed עם retry במקום spinner נצחי
const MAX_NOT_FOUND = 3; // ‏404 עקבי = השורה לא קיימת (נמחקה או שהיצירה לא התחילה)

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
  // בחירת עומק (D7): נשמרת עם הבקשה; נאכפת ביצירה מחוקה v3.
  const [depth, setDepth] = useState<"summary" | "standard">("standard");
  // token פר-לולאה: לולאה ישנה מתה ברגע שנפתחת חדשה (או ב-unmount) — בלי דגל משותף
  // שנדרס ב-StrictMode/remount ומשאיר שתי לולאות חיות במקביל (ממצא ביקורת).
  const pollToken = useRef(0);

  const poll = useCallback(async (targetSlug: string) => {
    const token = ++pollToken.current;
    const startedAt = Date.now();
    let notFound = 0;

    while (pollToken.current === token) {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        setStatus("failed");
        return;
      }
      try {
        const res = await fetch(`/api/entry/${encodeURIComponent(targetSlug)}`);
        if (pollToken.current !== token) return;
        if (res.status === 404) {
          // השורה לא קיימת — נמחקה ע"י admin או שהיצירה מעולם לא נרשמה.
          if (++notFound >= MAX_NOT_FOUND) {
            setError({ message: "הערך לא נמצא — ייתכן שהוסר. נסו לחפש שוב מדף הבית." });
            setStatus("error");
            return;
          }
        } else if (res.ok) {
          notFound = 0;
          const data = await res.json();
          if (pollToken.current !== token) return;
          if (data.status === "ready") {
            // הכתובת בשורת הדפדפן מתעדכנת ל-slug הקנוני (שיתוף/רענון תקינים).
            if (targetSlug !== slug) {
              window.history.replaceState(null, "", `/entry/${encodeURIComponent(targetSlug)}`);
            }
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
        // שגיאת רשת רגעית — ממשיכים לנסות (עד תקרת הזמן)
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }, [slug]);

  useEffect(() => {
    if (initialStatus === "creating") void poll(slug);
    return () => {
      pollToken.current++; // ביטול כל לולאה חיה של המופע הזה
    };
  }, [initialStatus, poll, slug]);

  async function create() {
    setStatus("creating");
    setError(null);
    try {
      const res = await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, depth }),
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
      // pending (202) או failed שהוחיה — polling על ה-slug הקנוני שהשרת החזיר:
      // נושא מנורמל (צה"ל→צהל) נשמר תחת slug שונה מזה שבכתובת (ממצא ביקורת).
      void poll(typeof data.slug === "string" && data.slug ? data.slug : slug);
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
  if (status === "failed") return <FailedState onRetry={create} />;

  return (
    <div className="mt-10 rounded-2xl border border-line bg-white p-6">
      <p className="font-medium text-ink">הנושא הזה עוד לא נחקר</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        עוד אין לנו ערך על &quot;{topic}&quot;. אפשר לבנות אותו עכשיו — ניצור אותו מכמה נקודות
        מבט מבוססות, וזה עשוי לקחת עד כמה דקות.
      </p>
      <fieldset className="mt-4">
        <legend className="mb-1.5 text-xs font-medium text-muted">רמת פירוט:</legend>
        <div className="flex gap-2">
          <label
            className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-medium transition ${depth === "standard" ? "border-accent bg-accent/10 text-accent" : "border-line bg-white text-muted hover:border-accent/50"}`}
          >
            <input type="radio" name="depth" value="standard" checked={depth === "standard"} onChange={() => setDepth("standard")} className="sr-only" />
            סקירה מפורטת
          </label>
          <label
            className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-medium transition ${depth === "summary" ? "border-accent bg-accent/10 text-accent" : "border-line bg-white text-muted hover:border-accent/50"}`}
          >
            <input type="radio" name="depth" value="summary" checked={depth === "summary"} onChange={() => setDepth("summary")} className="sr-only" />
            סיכום קצר
          </label>
        </div>
      </fieldset>
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
