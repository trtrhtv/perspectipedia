import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import { topicToSlug } from "@/lib/slug";

const EXAMPLES = ["בריאת העולם", "מהו צדק", "מהו מוות", "מהי תודעה", "משבר האקלים"];

export default function HomePage() {
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
              href={`/entry/${encodeURIComponent(topicToSlug(topic))}?q=${encodeURIComponent(topic)}`}
              className="rounded-full border border-line bg-white px-4 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent"
            >
              {topic}
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-16 text-center text-xs text-muted/70">
        כל עדשה מוצגת עם &quot;על מה זה מבוסס&quot;. עמדות ללא ביסוס אינן נכללות.
      </footer>
    </main>
  );
}
