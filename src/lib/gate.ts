import Anthropic from "@anthropic-ai/sdk";
import { estimateCostUsd } from "./claude";

// שער-נושא (PLAN 1.2, ROADMAP §4): קריאת Haiku זולה שמסווגת נושא לפני יצירת Opus.
// ההגנה המרכזית: סירוב קטגורי לערכים על אנשים פרטיים חיים — לפני שקריאה יקרה יוצאת.
// flag-gated: ENABLE_TOPIC_GATE=1 (ברירת מחדל כבוי). הפרומפט חי כאן ולא ב-prompts.ts —
// החוקה (eval-gated) היא של היצירה; השער הוא מסנן תפעולי נפרד.
//
// seam עתידי (ARCHITECTURE_TARGET §7): needs_care הוא אות הניתוב ל-tiering מודלים;
// canonical_topic הוא הבסיס לנרמול הסמנטי (ENABLE_SEMANTIC_NORMALIZE, PLAN 1.5ב).

const GATE_MODEL = process.env.GATE_MODEL ?? "claude-haiku-4-5-20251001";

export function isGateEnabled(): boolean {
  return process.env.ENABLE_TOPIC_GATE === "1";
}

export function isSemanticNormalizeEnabled(): boolean {
  return process.env.ENABLE_SEMANTIC_NORMALIZE === "1";
}

export interface GateResult {
  decision: "allow" | "refuse" | "needs_care";
  reason?: string; // אם refuse — הסבר מכובד למשתמש
  canonicalTopic?: string; // כותרת קנונית ניטרלית (בשימוש רק עם ENABLE_SEMANTIC_NORMALIZE)
  costUsd: number | null;
}

const GATE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decision"],
  properties: {
    decision: { type: "string", enum: ["allow", "refuse", "needs_care"] },
    reason: {
      type: "string",
      description: "אם refuse: הסבר קצר ומכובד בעברית למה הנושא מחוץ לתחום.",
    },
    canonical_topic: {
      type: "string",
      description:
        "כותרת קנונית ניטרלית לנושא (ניטרול ניסוח מוטה: 'למה X מסוכן' → 'X'). ריק אם הנושא כבר ניטרלי.",
    },
  },
} as const;

const GATE_PROMPT = `אתה שער הנושאים של perspectipedia — אנציקלופדיה עברית מרובת-נקודות-מבט על שאלות של משמעות, ערכים ופרשנות.

סווג את הנושא שיתקבל לאחת משלוש החלטות:

**refuse** — סירוב קטגורי, בלי יוצאים מהכלל:
- אדם פרטי חי או שנפטר לאחרונה (פוליטיקאי, איש ציבור, משפיען, אדם רגיל) — גם אם הניסוח עקיף ("המשפט של X", "הפרשה של Y").
- קבוצת אנשים מזוהה כמטרה להשמצה, או נושא שכל מהותו הסתה/שנאה.
- הדרכה לנזק (נשק, פגיעה עצמית, פשע).
- ספאם/ג'יבריש שאינו נושא אמיתי.

**needs_care** — נושא לגיטימי אך טעון במיוחד (שסעים חברתיים חריפים, טראומה לאומית, מחלוקת דתית-חילונית פעילה). היצירה תמשיך — הסיווג משמש לזהירות מוגברת.

**allow** — כל השאר: שאלות משמעות, מושגים, אירועים היסטוריים, רעיונות, תופעות תרבותיות.

בנוסף, אם ניסוח הנושא מוטה או טעון ("למה X נורא", "ההונאה של Y") — הצע ב-canonical_topic כותרת ניטרלית שמכסה את אותו נושא ("X", "Y"). אם הניסוח כבר ניטרלי — השאר ריק.

זכור: תפקידך לסנן, לא לצנזר. נושאים קשים, שנויים במחלוקת או לא-פופולריים הם לב המוצר — refuse שמור למה שמחוץ לתחום באופן קטגורי.`;

// הרצת השער. fail-open: כשל טכני (אין מפתח, שגיאת רשת) מחזיר null — לא חוסם יצירה,
// כי החוקה של Opus היא קו הגנה שני. עם הדגל כבוי — לא נקרא בכלל.
export async function runGate(topic: string): Promise<GateResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model: GATE_MODEL,
      max_tokens: 500,
      output_config: {
        format: {
          type: "json_schema",
          schema: GATE_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      system: GATE_PROMPT,
      messages: [{ role: "user", content: `הנושא: ${topic}` }],
    } as Anthropic.MessageCreateParamsNonStreaming);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    const raw = JSON.parse(textBlock.text) as {
      decision: GateResult["decision"];
      reason?: string;
      canonical_topic?: string;
    };
    return {
      decision: raw.decision,
      reason: raw.reason,
      canonicalTopic: raw.canonical_topic?.trim() || undefined,
      costUsd: estimateCostUsd(
        GATE_MODEL,
        message.usage?.input_tokens ?? null,
        message.usage?.output_tokens ?? null
      ),
    };
  } catch {
    return null;
  }
}
