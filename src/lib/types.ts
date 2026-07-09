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
}

export interface Lens {
  name: string;
  family: LensFamily;
  summary: string;
  body: string;
  grounding: GroundingItem[];
  epistemicType: EpistemicType;
  confidence?: string;
}

export interface Entry {
  slug: string;
  topic: string;
  topicKind: TopicKind;
  lenses: Lens[];
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

export const TOPIC_KIND_LABELS: Record<TopicKind, string> = {
  meaning: "שאלת משמעות",
  mixed: "משמעות ועובדה",
  empirical: "נושא עובדתי",
};
