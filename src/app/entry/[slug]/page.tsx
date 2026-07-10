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
  const topic = result?.kind === "entry" ? result.entry.topic : slugToTopic(slug);
  return { title: `${topic} — perspectipedia` };
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

      {result === null && <CreateEntryFlow topic={topic} />}
      {result?.kind === "entry" && <EntryDisplay entry={result.entry} />}
      {result?.kind === "refused" && <RefusedState reason={result.reason} />}
      {result?.kind === "pending_review" && <PendingReviewState />}
    </main>
  );
}
