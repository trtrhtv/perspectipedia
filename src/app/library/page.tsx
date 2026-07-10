import Link from "next/link";
import { listEntries } from "@/lib/entryService";
import { TOPIC_KIND_LABELS } from "@/lib/types";

// דף הספרייה נטען דינמית — משקף את הערכים שנצברו.
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const entries = await listEntries();

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted transition hover:text-accent">
          ← perspectipedia
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="mb-1 text-3xl font-bold tracking-tight">ספריית הערכים</h1>
        <p className="text-muted">
          {entries.length > 0
            ? `${entries.length} ערכים נחקרו עד כה.`
            : "עדיין לא נחקרו ערכים."}
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <p className="mb-4 text-muted">הספרייה ריקה. חקרו נושא ראשון כדי להתחיל לצבור.</p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-accent px-5 py-2 font-medium text-white transition hover:bg-accent/90"
          >
            לחקירת נושא
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e.slug}>
              <Link
                href={`/entry/${encodeURIComponent(e.slug)}`}
                className="block rounded-2xl border border-line bg-white p-5 transition hover:border-accent"
              >
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <h2 className="text-xl font-bold">{e.topic}</h2>
                  <span className="shrink-0 text-xs text-muted">
                    {TOPIC_KIND_LABELS[e.topicKind] ?? e.topicKind}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {e.lensNames.length} עדשות: {e.lensNames.join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
