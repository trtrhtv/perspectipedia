// טיפוסים משותפים לערך ולעדשות (frontend + backend)

export type LensFamily =
  | "religious"
  | "scientific"
  | "philosophical"
  | "political"
  | "cultural"
  | "historical";

export type EpistemicType =
  | "meaning-narrative"
  | "value-position"
  | "empirical-grounded"
  | "methodological-critique";

export type TopicKind = "meaning" | "mixed" | "empirical";

export interface GroundingItem {
  source: string; // המקור (פסוק, אסכולה, מחקר, הוגה...)
  explanation: string; // הסבר קצר איך זה מבסס את העדשה
  // קישור למקור בר-אחזור (ספריא, ויקיטקסט, DOI...) — שדרוג אמון, לא תנאי כניסה (D1).
  // מקור בלי url הוא לגיטימי לגמרי במסלול א' (מסורת שבעל-פה, קומון-סנס).
  url?: string;
}

// פרק בעדשה עמוקה (PLAN 4.5) — ב-v3 כל עדשה נכתבת בפרקים ("ערך-בתוך-ערך").
export interface LensSection {
  heading: string; // "מבוא", "זרמים ומחלוקות פנימיות"...
  content: string;
}

export interface Lens {
  name: string;
  family: LensFamily;
  summary: string;
  body: string;
  // קיים בערכי v3 (עומק ויקיפדי); בערכים ישנים undefined — הרנדרר נופל ל-body.
  sections?: LensSection[];
  grounding: GroundingItem[];
  epistemicType: EpistemicType;
  confidence?: string;
}

export interface Entry {
  slug: string;
  topic: string;
  topicKind: TopicKind;
  lenses: Lens[];
  // "מוקד המחלוקת" — על מה העדשות חלוקות ועל מה מסכימות (נכתב מחוקה v3; ריק בערכים ישנים).
  crux?: string;
  // חותמת שקיפות (PRE_KEY 2.3) — מוצגת בתחתית הערך.
  provenance?: { model: string; promptVersion: string; createdAt: string };
}

// תוויות עבריות למשפחות עדשות ולסוגי טענה
export const FAMILY_LABELS: Record<LensFamily, string> = {
  religious: "דתית",
  scientific: "מדעית",
  philosophical: "פילוסופית",
  political: "פוליטית",
  cultural: "תרבותית",
  historical: "היסטורית",
};

export const EPISTEMIC_LABELS: Record<EpistemicType, string> = {
  "meaning-narrative": "נרטיב ומשמעות",
  "value-position": "עמדה ערכית",
  "empirical-grounded": "טענה אמפירית מבוססת",
  "methodological-critique": "ביקורת מתודולוגית",
};

// הסבר לקורא מה הסטטוס האפיסטמי אומר (PLAN 4.1) — הסימטריה על הכבוד, לא על הסטטוס.
export const EPISTEMIC_EXPLANATIONS: Record<EpistemicType, string> = {
  "meaning-narrative":
    "העדשה מציעה דרך לראות ולהבין — סיפור, מסגור או משמעות. היא לא טוענת טענה מדידה.",
  "value-position":
    "העדשה מבטאת עמדה ערכית או מוסרית — מה ראוי, מה חשוב. ערכים אינם ניתנים להכרעה אמפירית.",
  "empirical-grounded":
    "העדשה נשענת על ראיות וממצאים הניתנים לבדיקה. אפשר לבחון אותה מול הנתונים.",
  "methodological-critique":
    "העדשה מבקרת את שיטות המחקר או הראיות מתוך השיח המקצועי — לא מחוצה לו.",
};

const EPISTEMIC_TINTS: Record<EpistemicType, string> = {
  "meaning-narrative": "bg-violet-50 text-violet-800 border-violet-200",
  "value-position": "bg-amber-50 text-amber-800 border-amber-200",
  "empirical-grounded": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "methodological-critique": "bg-sky-50 text-sky-800 border-sky-200",
};

export function epistemicTint(t: EpistemicType): string {
  return EPISTEMIC_TINTS[t] ?? "bg-stone-100 text-muted border-line";
}

export const TOPIC_KIND_LABELS: Record<TopicKind, string> = {
  meaning: "שאלת משמעות",
  mixed: "משמעות ועובדה",
  empirical: "נושא עובדתי",
};
