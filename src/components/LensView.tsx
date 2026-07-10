import type { Lens } from "@/lib/types";
import {
  FAMILY_LABELS,
  EPISTEMIC_LABELS,
  EPISTEMIC_EXPLANATIONS,
  epistemicTint,
} from "@/lib/types";
import ReportLink from "./ReportLink";

export default function LensView({ lens, compact = false }: { lens: Lens; compact?: boolean }) {
  return (
    <article>
      <header className="mb-3">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className={compact ? "text-xl font-bold" : "text-2xl font-bold"}>
            {lens.name}
          </h2>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-muted">
            {FAMILY_LABELS[lens.family] ?? lens.family}
          </span>
          {/* הסטטוס האפיסטמי — רכיב בולט ומוסבר, לא מטא-דאטה (PLAN 4.1).
              details/summary נגיש גם במגע ובמקלדת — לא רק tooltip לעכבר (PRE_KEY 2.2). */}
          <details className="relative inline-block">
            <summary
              className={`cursor-pointer list-none rounded-full border px-2.5 py-0.5 text-xs font-medium marker:content-none ${epistemicTint(lens.epistemicType)}`}
            >
              {EPISTEMIC_LABELS[lens.epistemicType] ?? lens.epistemicType} ⓘ
            </summary>
            <p className="absolute z-10 mt-1 w-64 rounded-xl border border-line bg-white p-3 text-xs font-normal leading-relaxed text-ink shadow-lg">
              {EPISTEMIC_EXPLANATIONS[lens.epistemicType]}
            </p>
          </details>
        </div>
        <p className="text-base leading-relaxed text-muted">{lens.summary}</p>
      </header>

      <div className="prose-body text-[15px] leading-relaxed text-ink">
        {lens.body.split(/\n{2,}|\n/).filter(Boolean).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {/* חלונית "על מה זה מבוסס" — מבחן הביסוס בפעולה */}
      <section className="mt-5 rounded-xl border border-line bg-white/60 p-4">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">על מה זה מבוסס</h3>
        </div>
        <ul className="space-y-2">
          {lens.grounding.map((g, i) => (
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
        {lens.confidence && (
          <p className="mt-3 border-t border-line pt-2 text-xs italic text-muted">
            {lens.confidence}
          </p>
        )}
      </section>

      <ReportLink lensName={lens.name} />
    </article>
  );
}
