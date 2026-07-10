import type { Lens } from "@/lib/types";
import { FAMILY_LABELS, EPISTEMIC_LABELS } from "@/lib/types";
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
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
            {EPISTEMIC_LABELS[lens.epistemicType] ?? lens.epistemicType}
          </span>
        </div>
        <ul className="space-y-2">
          {lens.grounding.map((g, i) => (
            <li key={i} className="text-sm leading-relaxed">
              <span className="font-medium text-ink">{g.source}</span>
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
