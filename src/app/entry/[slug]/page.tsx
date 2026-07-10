import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEntryResultBySlug, resolveExistingSlug } from "@/lib/entryService";
import { slugToTopic } from "@/lib/slug";
import EntryDisplay from "@/components/EntryDisplay";
import CreateEntryFlow from "@/components/CreateEntryFlow";
import { PendingReviewState, RefusedState } from "@/components/EntryStates";

// דף הערך הוא server component: קורא מה-DB בלבד ולעולם לא מייצר (PLAN 0.2).
// הכותרת המוצגת מגיעה תמיד מה-DB (Entry.topic) או נגזרת מה-slug — אין ערוץ ?q= (PLAN 0.3).

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const result = await getEntryResultBySlug(slug);

  // רק ערך מפורסם ראוי לאינדוקס. דפי "בנו את הערך"/pending/refused הם soft-404 —
  // בלי noindex קרולרים יאנדקסו אינסוף כתובות (PRE_KEY 1.1).
  if (result?.kind !== "entry") {
    return {
      title: `${slugToTopic(slug)} — perspectipedia`,
      robots: { index: false, follow: false },
    };
  }

  const entry = result.entry;
  const description =
    entry.crux ??
    entry.lenses.map((l) => `${l.name}: ${l.summary}`).join(" · ").slice(0, 300);
  return {
    title: `${entry.topic} — perspectipedia`,
    description,
    openGraph: {
      title: `${entry.topic} — perspectipedia`,
      description,
      type: "article",
      locale: "he_IL",
    },
  };
}

export default async function EntryPage({ params }: Params) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const result = await getEntryResultBySlug(slug);

  // ניסוח חלופי שמנתב לערך קיים (alias / ה"א-הידיעה) → הפניה לכתובת הקנונית.
  if (result === null) {
    const canonical = await resolveExistingSlug(slug);
    if (canonical && canonical !== slug) {
      redirect(`/entry/${encodeURIComponent(canonical)}`);
    }
  }

  if (result?.kind === "removed") notFound();

  const topic = result?.kind === "entry" ? result.entry.topic : slugToTopic(slug);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted transition hover:text-accent">
          ← perspectipedia
        </Link>
      </nav>

      <h1 className="mb-1 text-3xl font-bold tracking-tight">{topic}</h1>

      {result === null && <CreateEntryFlow topic={topic} slug={slug} />}
      {result?.kind === "entry" && (
        <>
          <EntryDisplay entry={result.entry} />
          {/* חותמת שקיפות (PRE_KEY 2.3) — BIAS_STRATEGY §6 ברמת הערך הבודד */}
          {result.entry.provenance && (
            <footer className="mt-10 border-t border-line pt-4 text-center text-xs text-muted/80">
              הערך נוצר בעזרת בינה מלאכותית ({result.entry.provenance.model}) · חוקה{" "}
              {result.entry.provenance.promptVersion} ·{" "}
              {new Date(result.entry.provenance.createdAt).toLocaleDateString("he-IL")} ·{" "}
              <Link href="/method" className="underline underline-offset-2 hover:text-accent">
                איך אנחנו מתמודדים עם הטיות
              </Link>
            </footer>
          )}
        </>
      )}
      {result?.kind === "refused" && <RefusedState reason={result.reason} />}
      {result?.kind === "pending_review" && <PendingReviewState />}
      {/* refresh באמצע יצירה חוזר לאותה יצירה — polling ממשיך מהשורה שב-DB */}
      {result?.kind === "pending" && (
        <CreateEntryFlow topic={topic} slug={slug} initialStatus="creating" />
      )}
      {result?.kind === "failed" && (
        <CreateEntryFlow topic={topic} slug={slug} initialStatus="failed" />
      )}
    </main>
  );
}
