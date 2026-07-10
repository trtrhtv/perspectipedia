"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";
import { TOPIC_KIND_LABELS } from "@/lib/types";
import LensSwitcher from "./LensSwitcher";
import LensView from "./LensView";
import CompareView from "./CompareView";
import EmpiricalBanner from "./EmpiricalBanner";

// תצוגה טהורה של ערך קיים — מקבלת entry כ-prop, לא יוצרת כלום.
export default function EntryDisplay({ entry }: { entry: Entry }) {
  const [active, setActive] = useState(0);
  const [compare, setCompare] = useState(false);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(Math.min(1, entry.lenses.length - 1));

  return (
    <>
      {entry.topicKind && (
        <p className="mb-4 text-sm text-muted">
          סוג הנושא: {TOPIC_KIND_LABELS[entry.topicKind] ?? entry.topicKind}
        </p>
      )}

      <EmpiricalBanner topicKind={entry.topicKind} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {!compare ? (
          <LensSwitcher lenses={entry.lenses} activeIndex={active} onSelect={setActive} />
        ) : (
          <span className="text-sm font-medium text-muted">מצב השוואה</span>
        )}

        {entry.lenses.length >= 2 && (
          <button
            onClick={() => setCompare((c) => !c)}
            className="shrink-0 rounded-full border border-line bg-white px-4 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            {compare ? "תצוגה בודדת" : "השוואה"}
          </button>
        )}
      </div>

      {!compare ? (
        <LensView lens={entry.lenses[active]} />
      ) : (
        <CompareView
          lenses={entry.lenses}
          leftIndex={left}
          rightIndex={right}
          onLeft={setLeft}
          onRight={setRight}
          crux={entry.crux}
        />
      )}
    </>
  );
}
