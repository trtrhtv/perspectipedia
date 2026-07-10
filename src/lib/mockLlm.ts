// מודל-דמה לבדיקות צנרת (PRE_KEY 3.1): MOCK_LLM=1 מפעיל תשובות קבועות במקום
// קריאות Anthropic — כך כל צנרת ה-async (job-row → generate → audit → persist →
// polling) נבדקת מקצה-לקצה בלי מפתח ובלי עלות. לעולם לא מופעל בפרודקשן.
//
// התנהגות לפי מילות-מפתח בנושא (לבדיקת כל המסלולים):
//   "סירוב"  → המודל מסרב (refused)
//   "כשל"    → שגיאה (מסלול failed)
//   "תיקון"  → ה-audit הראשון מחזיר revise; אחרי סבב תיקון — pass
//   "החזקה"  → ה-audit מחזיר revise גם אחרי תיקון (מסלול needs_review)
//   אחרת     → ערך תקין, audit pass

import type { AuditResult } from "./audit";

export function isMockLlmEnabled(): boolean {
  return process.env.MOCK_LLM === "1";
}

export interface MockRawLens {
  name: string;
  family: string;
  summary: string;
  body: string;
  grounding: { source: string; explanation: string; url?: string }[];
  epistemic_type: string;
  confidence?: string;
}

export function buildMockRaw(topic: string, revised = false): {
  topic: string;
  topic_kind: string;
  refused: boolean;
  refusal_reason?: string;
  lenses: MockRawLens[];
} {
  if (topic.includes("סירוב")) {
    return {
      topic,
      topic_kind: "meaning",
      refused: true,
      refusal_reason: "נושא-דמה שסומן לסירוב (MOCK_LLM).",
      lenses: [],
    };
  }
  if (topic.includes("כשל")) {
    throw new Error("mock: כשל מכוון לבדיקת מסלול failed");
  }
  const mark = revised ? " (אחרי תיקון)" : "";
  const lens = (name: string, family: string, et: string): MockRawLens => ({
    name,
    family,
    summary: `תקציר-דמה של עדשת ${name}${mark}.`,
    body: `גוף-דמה של עדשת ${name} על "${topic}"${mark} — טקסט ארוך מספיק כדי לעבור את מבחן אורך הגוף המינימלי בצנרת.`,
    grounding: [
      { source: `מקור-דמה של ${name}`, explanation: "הסבר-דמה לביסוס." },
    ],
    epistemic_type: et,
    confidence: undefined,
  });
  return {
    topic,
    topic_kind: "meaning",
    refused: false,
    lenses: [
      lens("עדשת-דמה ראשונה", "philosophical", "meaning-narrative"),
      lens("עדשת-דמה שנייה", "scientific", "empirical-grounded"),
    ],
  };
}

// audit-דמה: revise בסיבוב ראשון אם הנושא מבקש "תיקון"/"החזקה"; אחרי תיקון —
// pass ל"תיקון", עדיין revise ל"החזקה" (בודק את מסלול needs_review).
export function buildMockAudit(topic: string, afterRevision: boolean): AuditResult {
  const wantsRevise = topic.includes("תיקון") || topic.includes("החזקה");
  const stillBad = topic.includes("החזקה");
  const verdict = afterRevision ? (stillBad ? "revise" : "pass") : wantsRevise ? "revise" : "pass";
  return {
    scores: { steelman: verdict === "pass" ? 5 : 3 },
    flags:
      verdict === "pass"
        ? []
        : [
            {
              dimension: "שוויון חסד",
              severity: "major",
              lens: "עדשת-דמה ראשונה",
              evidence: "ראיה-דמה (MOCK_LLM)",
              fix_instruction: "חזק את העדשה המוחלשת.",
            },
          ],
    verdict,
  };
}
