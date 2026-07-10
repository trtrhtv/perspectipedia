import Link from "next/link";

export const metadata = {
  title: "על השיטה — perspectipedia",
  description: "איך perspectipedia מתמודדת עם הטיות, ומה אנחנו מבטיחים (ומה לא).",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-xl font-bold">{title}</h2>
      <div className="space-y-2 text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default function MethodPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted transition hover:text-accent">
          ← perspectipedia
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">על השיטה שלנו</h1>
        <p className="text-muted">
          perspectipedia עוסקת בהוגנות — אז מגיע לכם לדעת בדיוק איך אנחנו עובדים, ומה אנחנו
          מבטיחים ומה לא.
        </p>
      </header>

      <Section title="הערכים נוצרים בעזרת בינה מלאכותית">
        <p>
          כל ערך נכתב על ידי מודל שפה (Claude). זה מאפשר כיסוי של כל נושא, אבל דורש כנות: למודל
          יש נטיות מובנות מהאימון שלו — פוליטיות, תרבותיות ולשוניות — והוא אינו יכול לזהות אותן
          בעצמו במלואן.
        </p>
      </Section>

      <Section title="מה אנחנו עושים כדי לצמצם הטיה">
        <ul className="list-disc space-y-1.5 pr-5">
          <li>
            <b>מבחן הביסוס:</b> עדשה נכנסת רק אם היא מנומקת ומבוססת על מקורות אמיתיים. כל טענה
            מעוגנת במקור — כך המודל מוגבל למה שהמסורת באמת אומרת, לא לסיכום שלו עליה.
          </li>
          <li>
            <b>חוקת סימטריה:</b> ההנחיה למודל מנקבת במפורש בהטיות שלו ומחייבת חסד שווה — כל עדשה
            בגרסתה החזקה ביותר, בעומק ובאיכות דומים, בלי לרמוז "מי צודק".
          </li>
          <li>
            <b>מבקר אדוורסרי:</b> מעבר שני שבוחן כל ערך כדי לאתר אסימטריה (עדשה שנכתבה בחמלה
            או עומק רבים יותר, שפה טעונה, עמדה חסרה) ולתקן. חלק מהבדיקה נעשה עם תוויות מוסתרות
            (שמות העדשות והמקורות מוחלפים) — וביושר: זה מנטרל הטיה כלפי <i>שמות</i> של עולמות,
            אבל תוכן שכתוב בקולה של מסורת עדיין מזוהה מהטקסט עצמו. זו הפחתת הטיה, לא חסינות.
          </li>
          <li>
            <b>ביקורת אינסיידרים:</b> בני העולמות עצמם קוראים את העדשה שלהם ומאשרים שהיא מייצגת
            אותם בכבוד ובדיוק.
          </li>
          <li>
            <b>הבחנה בין עובדה לפרשנות:</b> על נושאים עובדתיים איננו מציגים "איזון שקרי" — קונצנזוס
            מדעי מבוסס אינו "סתם עוד דעה".
          </li>
        </ul>
      </Section>

      <Section title="מה איננו מבטיחים">
        <p>
          איננו טוענים ל<b>אובייקטיביות</b> או ל<b>נייטרליות</b> מושלמת — טענה כזו לא ניתנת להוכחה
          ולא נכונה. הטיה שנותרה היא אפשרית, ולכן אנחנו מודדים אותה ומזמינים אתכם לדווח עליה.
        </p>
      </Section>

      <Section title="מה כן אנחנו מבטיחים">
        <p className="rounded-xl border border-line bg-white p-4 font-medium">
          הוגן, מבוסס, ונבדק — כל עדשה בגרסתה החזקה ביותר, מבוססת על מקורותיה, ונבדקת לסימטריה.
          ואיננו פוסקים מי צודק.
        </p>
      </Section>

      <div className="mt-10 border-t border-line pt-6 text-center">
        <Link
          href="/"
          className="inline-block rounded-xl bg-accent px-5 py-2 font-medium text-white transition hover:bg-accent/90"
        >
          לחקירת נושא
        </Link>
      </div>
    </main>
  );
}
