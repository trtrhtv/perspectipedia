import type { Lens } from "@/lib/types";
import LensView from "./LensView";

function ColumnSelect({
  lenses,
  value,
  onChange,
}: {
  lenses: Lens[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mb-4 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium outline-none focus:border-accent"
    >
      {lenses.map((l, i) => (
        <option key={i} value={i}>
          {l.name}
        </option>
      ))}
    </select>
  );
}

// מצב השוואה — שתי עדשות זו לצד זו, כל צד ניתן להחלפה.
export default function CompareView({
  lenses,
  leftIndex,
  rightIndex,
  onLeft,
  onRight,
}: {
  lenses: Lens[];
  leftIndex: number;
  rightIndex: number;
  onLeft: (i: number) => void;
  onRight: (i: number) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-line bg-paper p-5">
        <ColumnSelect lenses={lenses} value={leftIndex} onChange={onLeft} />
        <LensView lens={lenses[leftIndex]} compact />
      </div>
      <div className="rounded-2xl border border-line bg-paper p-5">
        <ColumnSelect lenses={lenses} value={rightIndex} onChange={onRight} />
        <LensView lens={lenses[rightIndex]} compact />
      </div>
    </div>
  );
}
