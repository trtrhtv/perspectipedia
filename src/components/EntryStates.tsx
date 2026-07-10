import Link from "next/link";

// מסכי מצב של דף הערך — ללא אינטראקטיביות, ניתנים לרינדור גם בשרת וגם בלקוח.

export function LoadingState() {
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

export function PendingReviewState() {
  return (
    <div className="mt-10 rounded-2xl border border-line bg-white p-6">
      <p className="font-medium text-ink">הערך בבדיקת הוגנות</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        הערך הזה נוצר, אבל מבקר הסימטריה שלנו סימן אותו לבדיקה נוספת לפני פרסום. הוא יופיע כאן
        ברגע שהבדיקה תושלם.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">
        ← חזרה לדף הבית
      </Link>
    </div>
  );
}

export function RefusedState({ reason }: { reason: string }) {
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

export function ErrorState({ error }: { error: { message: string; code?: string } }) {
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
