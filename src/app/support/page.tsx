import Link from "next/link";
import { notFound } from "next/navigation";

// דף תרומות (PLAN 4.10) — מוסתר עד הפעלה: NEXT_PUBLIC_SHOW_SUPPORT=1.
// כשמפעילים: מוסיפים כאן קישורי תשלום אמיתיים (Ko-fi / PayPal / Buy Me a Coffee).

export const metadata = {
  title: "תמכו בפרויקט — perspectipedia",
  robots: { index: false, follow: false }, // עד ההפעלה הרשמית
};

export default function SupportPage() {
  if (process.env.NEXT_PUBLIC_SHOW_SUPPORT !== "1") notFound();

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted transition hover:text-accent">
          ← perspectipedia
        </Link>
      </nav>

      <h1 className="mb-3 text-3xl font-bold tracking-tight">תמכו בפרויקט</h1>
      <p className="mb-4 leading-relaxed text-ink">
        perspectipedia היא פרויקט עצמאי ללא מטרות רווח: אנציקלופדיה הוגנת, מרובת נקודות מבט,
        פתוחה לכולם וללא פרסומות. כל ערך חדש עולה כסף אמיתי (יצירה, בדיקות הוגנות, תשתית) —
        והתמיכה שלכם היא מה שמאפשר להרחיב את הספרייה ולשמור עליה חופשית.
      </p>
      <p className="mb-8 text-sm text-muted">
        התרומות משמשות אך ורק לתפעול: עלויות יצירת הערכים, בדיקות ההוגנות, והאחסון.
      </p>

      <div className="rounded-2xl border border-line bg-white p-6 text-center">
        <p className="font-medium text-ink">אפשרויות התרומה יתפרסמו כאן בקרוב.</p>
        <p className="mt-2 text-sm text-muted">
          בינתיים — הדרך הטובה ביותר לעזור היא לקרוא, להשוות עדשות, ולדווח לנו על כל הטיה
          שמצאתם.
        </p>
      </div>
    </main>
  );
}
