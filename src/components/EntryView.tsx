"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Entry } from "@/lib/types";
import { TOPIC_KIND_LABELS } from "@/lib/types";
import LensSwitcher from "./LensSwitcher";
import LensView from "./LensView";
import CompareView from "./CompareView";

type Status = "loading" | "ready" | "error" | "refused";

export default function EntryView({ topic }: { topic: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [refusalReason, setRefusalReason] = useState<string>("");

  const [active, setActive] = useState(0);
  const [compare, setCompare] = useState(false);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetch("/api/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
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
        setEntry(data.entry as Entry);
        setRight(Math.min(1, (data.entry.lenses.length ?? 1) - 1));
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setError({ message: "החיבור נכשל. נסו שוב." });
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [topic]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted transition hover:text-accent">
          ← perspectipedia
        </Link>
      </nav>

      <h1 className="mb-1 text-3xl font-bold tracking-tight">{topic}</h1>

      {status === "loading" && <LoadingState />}
      {status === "error" && error && <ErrorState error={error} />}
      {status === "refused" && <RefusedState reason={refusalReason} />}

      {status === "ready" && entry && (
        <>
          {entry.topicKind && (
            <p className="mb-6 text-sm text-muted">
              סוג הנושא: {TOPIC_KIND_LABELS[entry.topicKind] ?? entry.topicKind}
            </p>
          )}

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {!compare ? (
              <LensSwitcher
                lenses={entry.lenses}
                activeIndex={active}
                onSelect={setActive}
              />
            ) : (
              <span className="text-sm font-medium text-muted">מצב השוואה</span>
            )}

            {entry.lenses.length >= 2 && (
              <button
                onClick={() => setCompare((c) => !c)}
                className="shrink-0 rounded-full border border-line bg-white px-4 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
              >
                {compare ? "תצוגה בודדת" : "השוואה"}
              </button>
            )}
          </div>

          {!compare ? (
            <LensView lens={entry.lenses[active]} />
          ) : (
            <CompareView
              lenses={entry.lenses}
              leftIndex={left}
              rightIndex={right}
              onLeft={setLeft}
              onRight={setRight}
            />
          )}
        </>
      )}
    </main>
  );
}

function LoadingState() {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 py-16 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      <p className="text-muted">בונים את הערך מכמה נקודות מבט…</p>
      <p className="max-w-sm text-xs text-muted/70">
        זו הפעם הראשונה שהנושא הזה נחקר, אז אנחנו מייצרים אותו עכשיו. בפעם הבאה הוא ייטען מיד.
      </p>
    </div>
  );
}

function RefusedState({ reason }: { reason: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-line bg-white p-6">
      <p className="font-medium text-ink">הנושא הזה מחוץ לתחום שלנו</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{reason}</p>
      <p className="mt-3 text-xs text-muted/80">
        perspectipedia מציגה נקודות מבט מבוססות על שאלות של משמעות, ערכים ופרשנות — לא ערכים על
        אנשים פרטיים, ולא במה להסתה או לתוכן מזיק.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">
        ← חזרה לדף הבית
      </Link>
    </div>
  );
}

function ErrorState({ error }: { error: { message: string; code?: string } }) {
  return (
    <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <p className="font-medium text-amber-900">לא הצלחנו לבנות את הערך</p>
      <p className="mt-1 text-sm text-amber-800">{error.message}</p>
      {error.code === "no_api_key" && (
        <p className="mt-3 text-xs text-amber-700">
          כדי לאפשר יצירת ערכים, הוסיפו <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code>{" "}
          לקובץ <code className="rounded bg-amber-100 px-1">.env.local</code> והפעילו מחדש את השרת.
        </p>
      )}
      <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">
        ← חזרה לדף הבית
      </Link>
    </div>
  );
}
