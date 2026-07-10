import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import { listEntries } from "@/lib/entryService";
import { topicToSlug } from "@/lib/slug";

const EXAMPLES = ["בריאת העולם", "מהו צדק", "מהו מוות", "מהי תודעה", "משבר האקלים"];

// דף הבית מציג "נחקרו לאחרונה" — מתרענן כל דקה (ISR), לא בכל בקשה.
export const revalidate = 60;

export default async function HomePage() {
  const recent = (await listEntries()).slice(0, 4);
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-16">
      <header className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
          perspectipedia
        </h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted">
          אנציקלופדיה הוגנת, מרובת נקודות מבט. קראו כל נושא דרך כמה עדשות מבוססות —
          בכבוד — והשוו ביניהן.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted/80">
          לא &quot;מי צודק&quot;, אלא איך כל עולם מבין את זה — ועל מה הוא מבסס.
        </p>
      </header>

      <SearchBox autoFocus />

      <section className="mt-8">
        <p className="mb-3 text-center text-sm text-muted">נושאים לדוגמה:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((topic) => (
            <Link
              key={topic}
              href={`/entry/${encodeURIComponent(topicToSlug(topic))}`}
              className="rounded-full border border-line bg-white px-4 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent"
            >
              {topic}
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <p className="mb-3 text-center text-sm text-muted">נחקרו לאחרונה:</p>
          <ul className="mx-auto max-w-md space-y-2">
            {recent.map((e) => (
              <li key={e.slug}>
                <Link
                  href={`/entry/${encodeURIComponent(e.slug)}`}
                  className="block rounded-xl border border-line bg-white px-4 py-2.5 text-sm transition hover:border-accent"
                >
                  <span className="font-medium">{e.topic}</span>
                  <span className="text-muted"> · {e.lensNames.length} עדשות</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 flex justify-center gap-5 text-center text-sm">
        <Link
          href="/library"
          className="text-muted underline-offset-4 transition hover:text-accent hover:underline"
        >
          ספריית הערכים ←
        </Link>
        <Link
          href="/method"
          className="text-muted underline-offset-4 transition hover:text-accent hover:underline"
        >
          על השיטה שלנו ←
        </Link>
      </div>

      <footer className="mt-16 text-center text-xs text-muted/70">
        כל עדשה מוצגת עם &quot;על מה זה מבוסס&quot;. עמדות ללא ביסוס אינן נכללות.
      </footer>
    </main>
  );
}
