"use client";

import { useState } from "react";
import type { Lens, LensSection } from "@/lib/types";
import {
  FAMILY_LABELS,
  EPISTEMIC_LABELS,
  EPISTEMIC_EXPLANATIONS,
  epistemicTint,
} from "@/lib/types";
import GroundingPanel from "./GroundingPanel";
import ReportLink from "./ReportLink";

// כותרת עדשה — שם, משפחה, סטטוס אפיסטמי ותמצית. משמשת גם את ההשוואה הפרקית (4.6).
export function LensHeader({ lens, compact = false }: { lens: Lens; compact?: boolean }) {
  return (
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
  );
}

export function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}|\n/).filter(Boolean).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

// כמה פרקים פתוחים כברירת מחדל במצב "תקציר" — המבוא בלבד (PRE_KEY א.4:
// "תקציר/מלא" הוא פיצ'ר תצוגה; תמיד מייצרים ושומרים את המבנה המלא).
const SUMMARY_OPEN_COUNT = 1;
// תוכן-עניינים מוצג רק לעדשה עמוקה באמת.
const TOC_MIN_SECTIONS = 4;

function SectionedBody({
  sections,
  idPrefix,
}: {
  sections: LensSection[];
  idPrefix: string;
}) {
  const [open, setOpen] = useState<boolean[]>(() =>
    sections.map((_, i) => i < SUMMARY_OPEN_COUNT)
  );
  const allOpen = open.every(Boolean);

  const setAll = (v: boolean) =>
    setOpen(sections.map((_, i) => (v ? true : i < SUMMARY_OPEN_COUNT)));
  const toggle = (i: number) =>
    setOpen((prev) => prev.map((o, j) => (j === i ? !o : o)));
  const openAndScroll = (i: number) => {
    setOpen((prev) => prev.map((o, j) => (j === i ? true : o)));
    // אחרי שהפרק נפתח — גלילה אליו (רץ אחרי ה-render הנוכחי).
    requestAnimationFrame(() => {
      document.getElementById(`${idPrefix}-sec-${i}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <div>
      {/* בורר תקציר/מלא — פיצ'ר קריאה, לא יצירה (D7 מבחין ביניהם) */}
      <div
        className="mb-4 inline-flex rounded-full border border-line bg-white p-0.5 text-sm"
        role="group"
        aria-label="עומק תצוגה"
      >
        <button
          onClick={() => setAll(false)}
          aria-pressed={!allOpen}
          className={
            "rounded-full px-3.5 py-1 font-medium transition " +
            (!allOpen ? "bg-accent text-white" : "text-muted hover:text-accent")
          }
        >
          תקציר
        </button>
        <button
          onClick={() => setAll(true)}
          aria-pressed={allOpen}
          className={
            "rounded-full px-3.5 py-1 font-medium transition " +
            (allOpen ? "bg-accent text-white" : "text-muted hover:text-accent")
          }
        >
          מלא
        </button>
      </div>

      {/* תוכן עניינים מקומי לעדשה (PLAN 4.5) */}
      {sections.length >= TOC_MIN_SECTIONS && (
        <nav
          aria-label="פרקי העדשה"
          className="mb-4 rounded-xl border border-line bg-white/60 p-3"
        >
          <p className="mb-1.5 text-xs font-semibold text-muted">בפרק זה</p>
          <ol className="space-y-1">
            {sections.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => openAndScroll(i)}
                  className="text-sm text-accent hover:underline"
                >
                  {s.heading}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="space-y-1">
        {sections.map((s, i) => (
          <section
            key={i}
            id={`${idPrefix}-sec-${i}`}
            className="scroll-mt-4 border-b border-line/70 last:border-b-0"
          >
            <h3>
              <button
                onClick={() => toggle(i)}
                aria-expanded={open[i]}
                className="flex w-full items-center justify-between gap-2 py-2.5 text-start text-base font-semibold text-ink transition hover:text-accent"
              >
                <span>{s.heading}</span>
                <span aria-hidden className="text-xs text-muted">
                  {open[i] ? "▲" : "▼"}
                </span>
              </button>
            </h3>
            {open[i] && (
              <div className="prose-body pb-4 text-[15px] leading-relaxed text-ink">
                <Paragraphs text={s.content} />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export default function LensView({ lens, compact = false }: { lens: Lens; compact?: boolean }) {
  const hasSections = !!lens.sections && lens.sections.length > 0;

  return (
    <article>
      <LensHeader lens={lens} compact={compact} />

      {hasSections ? (
        // ערך עמוק (v3) — פרקים, תוכן-עניינים, תקציר/מלא (PLAN 4.5).
        // key מאפס את מצב הקיפול במעבר עדשה.
        <SectionedBody key={lens.name} sections={lens.sections!} idPrefix={`lens-${lens.name}`} />
      ) : (
        // תאימות לאחור — ערכי v2 עם body רציף.
        <div className="prose-body text-[15px] leading-relaxed text-ink">
          <Paragraphs text={lens.body} />
        </div>
      )}

      <GroundingPanel grounding={lens.grounding} confidence={lens.confidence} />

      <ReportLink lensName={lens.name} />
    </article>
  );
}
