import type { Lens } from "@/lib/types";

// בורר עדשות — משקל ויזואלי שווה לכל עדשה (מסגור סימטרי).
export default function LensSwitcher({
  lenses,
  activeIndex,
  onSelect,
}: {
  lenses: Lens[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="עדשות">
      {lenses.map((lens, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={i}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={
              "rounded-full border px-4 py-1.5 text-sm font-medium transition " +
              (active
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-ink hover:border-accent hover:text-accent")
            }
          >
            {lens.name}
          </button>
        );
      })}
    </div>
  );
}
