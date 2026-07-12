import type { GroundingItem } from "@/lib/types";

// חלונית "על מה זה מבוסס" — מבחן הביסוס בפעולה. חולץ מ-LensView כדי לשמש גם
// את ההשוואה הפרקית (PLAN 4.6), שם הביסוס מוצג פר-עמודה בתחתית.
export default function GroundingPanel({
  grounding,
  confidence,
}: {
  grounding: GroundingItem[];
  confidence?: string;
}) {
  return (
    <section className="mt-5 rounded-xl border border-line bg-white/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">על מה זה מבוסס</h3>
      </div>
      <ul className="space-y-2">
        {grounding.map((g, i) => (
          <li key={i} className="text-sm leading-relaxed">
            <span className="font-medium text-ink">{g.source}</span>
            {/* מקור מקושר = שדרוג אמון; היעדר קישור לגיטימי — לעולם לא ניסוח מבטל (D1) */}
            {g.url ? (
              <a
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-1.5 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-px text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
              >
                מקור מקושר ↗
              </a>
            ) : (
              <span className="mx-1.5 inline-block rounded-full border border-line bg-stone-50 px-2 py-px text-[11px] text-muted">
                מקור מסורתי / כללי
              </span>
            )}
            <span className="text-muted"> — {g.explanation}</span>
          </li>
        ))}
      </ul>
      {confidence && (
        <p className="mt-3 border-t border-line pt-2 text-xs italic text-muted">
          {confidence}
        </p>
      )}
    </section>
  );
}
