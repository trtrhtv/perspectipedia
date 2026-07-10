"use client";

import { useCallback, useEffect, useState } from "react";

// ממשק ניהול מינימלי (PLAN 1.3): token יחיד, טבלת כל הערכים (כולל needs_review/refused),
// פעולות publish / hold / remove / delete וטיפול בדיווחים. זהו גם תור ה-needs_review.

interface AdminReport {
  id: string;
  lensName: string | null;
  reason: string;
  createdAt: string;
}

interface AdminEntry {
  slug: string;
  topic: string;
  status: string;
  refusalReason: string | null;
  promptVersion: string;
  model: string;
  costUsd: number | null;
  createdAt: string;
  lenses: { name: string }[];
  reports: AdminReport[];
}

const STATUS_LABELS: Record<string, string> = {
  published: "מפורסם",
  needs_review: "בבדיקה",
  refused: "סורב",
  removed: "הוסר",
  pending: "בתהליך",
  failed: "נכשל",
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (tok: string) => {
    setError("");
    const res = await fetch("/api/admin/entries", { headers: { "x-admin-token": tok } });
    if (!res.ok) {
      setAuthed(false);
      setError(res.status === 401 ? "token שגוי או שלא הוגדר ADMIN_TOKEN בשרת." : "שגיאה בטעינה.");
      return;
    }
    const data = await res.json();
    setEntries(data.entries);
    setTotalCost(data.totalCostUsd ?? 0);
    setAuthed(true);
    try {
      sessionStorage.setItem("admin_token", tok);
    } catch {}
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_token");
    if (saved) {
      setToken(saved);
      void load(saved);
    }
  }, [load]);

  async function act(slug: string, patch: Record<string, unknown> | null) {
    setBusy(true);
    try {
      if (patch) {
        await fetch("/api/admin/entries", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-token": token },
          body: JSON.stringify({ slug, ...patch }),
        });
      } else {
        await fetch(`/api/admin/entries?slug=${encodeURIComponent(slug)}`, {
          method: "DELETE",
          headers: { "x-admin-token": token },
        });
      }
      await load(token);
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="mb-4 text-2xl font-bold">ניהול perspectipedia</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(token);
          }}
          className="space-y-3"
        >
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_TOKEN"
            className="w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-xl bg-accent px-5 py-2 font-medium text-white hover:bg-accent/90"
          >
            כניסה
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </main>
    );
  }

  const reviewQueue = entries.filter((e) => e.status === "needs_review");
  const openReports = entries.flatMap((e) => e.reports.map((r) => ({ ...r, slug: e.slug, topic: e.topic })));

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="mb-2 text-2xl font-bold">ניהול perspectipedia</h1>
      <p className="mb-6 text-sm text-muted">
        {entries.length} ערכים · תור בדיקה: {reviewQueue.length} · דיווחים פתוחים: {openReports.length} ·
        עלות מצטברת: ${totalCost.toFixed(2)}
      </p>

      {openReports.length > 0 && (
        <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 font-semibold text-amber-900">דיווחים פתוחים</h2>
          <ul className="space-y-2">
            {openReports.map((r) => (
              <li key={r.id} className="text-sm text-amber-900">
                <span className="font-medium">{r.topic}</span>
                {r.lensName && <span className="text-amber-700"> · עדשה: {r.lensName}</span>}
                <span className="text-amber-800"> — {r.reason}</span>
                <button
                  onClick={() => act(r.slug, { resolveReports: true })}
                  disabled={busy}
                  className="mr-3 text-xs underline hover:no-underline"
                >
                  סימון כטופל
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="p-3">נושא</th>
              <th className="p-3">מצב</th>
              <th className="p-3">עדשות</th>
              <th className="p-3">גרסה</th>
              <th className="p-3">עלות</th>
              <th className="p-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.slug} className="border-b border-line/50 last:border-0">
                <td className="p-3">
                  <a href={`/entry/${encodeURIComponent(e.slug)}`} className="font-medium hover:text-accent">
                    {e.topic}
                  </a>
                  {e.refusalReason && (
                    <p className="mt-0.5 text-xs text-muted">{e.refusalReason}</p>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={
                      e.status === "published"
                        ? "text-green-700"
                        : e.status === "needs_review"
                          ? "font-medium text-amber-700"
                          : "text-muted"
                    }
                  >
                    {STATUS_LABELS[e.status] ?? e.status}
                  </span>
                </td>
                <td className="p-3 text-muted">{e.lenses.length}</td>
                <td className="p-3 text-muted">{e.promptVersion}</td>
                <td className="p-3 text-muted">{e.costUsd != null ? `$${e.costUsd.toFixed(3)}` : "—"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {e.status !== "published" && e.status !== "refused" && (
                      <button onClick={() => act(e.slug, { status: "published" })} disabled={busy} className="text-green-700 underline hover:no-underline">
                        פרסום
                      </button>
                    )}
                    {e.status === "published" && (
                      <button onClick={() => act(e.slug, { status: "needs_review" })} disabled={busy} className="text-amber-700 underline hover:no-underline">
                        החזקה לבדיקה
                      </button>
                    )}
                    {e.status !== "removed" && (
                      <button onClick={() => act(e.slug, { status: "removed" })} disabled={busy} className="text-muted underline hover:no-underline">
                        הסרה
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`למחוק לצמיתות את "${e.topic}"? הפעולה משחררת את ה-slug.`)) {
                          void act(e.slug, null);
                        }
                      }}
                      disabled={busy}
                      className="text-red-600 underline hover:no-underline"
                    >
                      מחיקה
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
