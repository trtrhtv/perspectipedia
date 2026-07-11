import Anthropic from "@anthropic-ai/sdk";
import { AUDIT_JSON_SCHEMA } from "./schema";
import { SYMMETRY_AUDIT_PROMPT } from "./prompts";
import type { Entry } from "./types";

// מבקר הסימטריה האדוורסרי (docs/BIAS_STRATEGY.md §3).
// מופעל רק כאשר ENABLE_SYMMETRY_AUDIT=1 — לפי האסטרטגיה, ההפעלה בפרודקשן
// מותנית ב-baseline eval שמאמת את רף ההוגנות (דורש מפתח + סט נושאי-זהב).
export function isAuditEnabled(): boolean {
  return process.env.ENABLE_SYMMETRY_AUDIT === "1";
}

export interface AuditFlag {
  dimension: string;
  severity: "minor" | "major";
  lens: string;
  evidence: string;
  fix_instruction: string;
}
export interface AuditResult {
  scores: Record<string, number>;
  flags: AuditFlag[];
  missing_lenses?: { name: string; why_grounded: string }[];
  verdict: "pass" | "revise" | "fail";
}

// בניית שני מבטים: מוסווה (למלאכה) וגלוי (לזהות).
//
// גבולות ההסוואה — ביושר (PLAN 3.4): ההסוואה מחליפה תוויות (שמות עדשות ומקורות),
// לא תוכן. עדשה שכתובה בקולה של מסורת מזוהה מגוף הטקסט. כלומר המבט ה"מוסווה"
// מנטרל הטיית-תווית בלבד; הסוואה ברמת התוכן (השוואת פסקאות מנותקות-הקשר) — v2.
function buildViews(entry: Entry): { masked: string; unmasked: string } {
  const letters = ["א", "ב", "ג", "ד", "ה"];
  const masked = {
    topic: entry.topic,
    lenses: entry.lenses.map((l, i) => ({
      name: `עדשה ${letters[i] ?? i + 1}׳`,
      summary: l.summary,
      body: l.body,
      grounding: l.grounding.map((_, gi) => ({
        source: `[מקור ${gi + 1}]`,
        explanation: l.grounding[gi].explanation,
      })),
    })),
  };
  // המבט הגלוי כולל גם את ה-body: ממדים 4-6 (עומק ביסוס, עושר, שפה) נשפטים
  // על הטקסט המלא — לא על תקציר בלבד (תוקן ב-PLAN 3.4).
  const unmasked = {
    topic: entry.topic,
    lenses: entry.lenses.map((l) => ({
      name: l.name,
      family: l.family,
      summary: l.summary,
      body: l.body,
      epistemicType: l.epistemicType,
      grounding: l.grounding,
    })),
  };
  return {
    masked: JSON.stringify(masked, null, 2),
    unmasked: JSON.stringify(unmasked, null, 2),
  };
}

// הרצת ביקורת על ערך. מחזיר null אם המבקר כשל (fail-open — לא חוסם יצירה).
// opts.afterRevision: הביקורת החוזרת שאחרי סבב התיקון (PLAN 3.7).
export async function runAudit(
  entry: Entry,
  opts: { afterRevision?: boolean } = {}
): Promise<AuditResult | null> {
  // מצב דמה (PRE_KEY 3.1) — בדיקת צנרת הביקורת בלי API.
  const { isMockLlmEnabled, buildMockAudit } = await import("./mockLlm");
  if (isMockLlmEnabled()) {
    return buildMockAudit(entry.topic, !!opts.afterRevision);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const { masked, unmasked } = buildViews(entry);

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: AUDIT_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      system: SYMMETRY_AUDIT_PROMPT,
      messages: [
        {
          role: "user",
          content: `מבט מוסווה (לממדים 1-3):\n${masked}\n\nמבט גלוי (לממדים 4-6):\n${unmasked}`,
        },
      ],
    } as Anthropic.MessageStreamParams);

    const message = await stream.finalMessage();
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    return JSON.parse(textBlock.text) as AuditResult;
  } catch {
    // ביקורת היא שכבת-הגנה, לא חוסם — כשל בה לא מונע פרסום.
    return null;
  }
}
