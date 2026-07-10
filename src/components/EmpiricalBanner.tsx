import type { TopicKind } from "@/lib/types";

// באנר עובדתי (PLAN 4.1) — המענה ל-bothsidesism ויזואלי: בנושאים עם ממד אמפירי,
// עמודות שוות אינן אומרות "50/50". הסימטריה חלה על הכבוד, לא על הסטטוס האפיסטמי.
export default function EmpiricalBanner({ topicKind }: { topicKind: TopicKind }) {
  if (topicKind === "meaning") return null;

  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed">
      <p className="font-medium text-emerald-900">
        {topicKind === "empirical"
          ? "לנושא הזה יש בסיס עובדתי — קונצנזוס מדעי או ממצאים מבוססים."
          : "לנושא הזה יש גם ממד עובדתי מוסכם וגם ממד של משמעות ופרשנות."}
      </p>
      <p className="mt-1 text-emerald-800">
        העדשות שלפניכם הן דרכים שונות להבין את <b>משמעותו</b> — הן אינן עמדות שוות-מעמד לגבי
        העובדות עצמן. שימו לב לתווית של כל עדשה: "טענה אמפירית" נבחנת מול ראיות; "נרטיב
        ומשמעות" ו"עמדה ערכית" הן פרשנות.
      </p>
    </div>
  );
}
