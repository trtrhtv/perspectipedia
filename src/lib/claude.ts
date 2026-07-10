import Anthropic from "@anthropic-ai/sdk";
import { ENTRY_JSON_SCHEMA } from "./schema";
import { SYSTEM_PROMPT, PROMPT_VERSION, buildUserPrompt } from "./prompts";
import type { Entry, Lens } from "./types";
import { topicToSlug } from "./slug";
import { isAuditEnabled, runAudit } from "./audit";

// מודל: Claude Opus 4.8 — הכי חזק, קריטי לניואנס ולייצוג מכבד.
const MODEL = "claude-opus-4-8";
const MIN_LENSES = 2; // מבחן הביסוס: חייבות לשרוד לפחות 2 עדשות מבוססות
const MIN_BODY_CHARS = 40; // גוף עדשה קצר מדי = לא ערך אמיתי
const MAX_ATTEMPTS = 2; // retry אחד על כשל parse/transient

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY חסר. הוסף אותו ל-.env.local כדי לאפשר יצירת ערכים.");
    this.name = "MissingApiKeyError";
  }
}

export interface GenerationMeta {
  promptVersion: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  needsReview?: boolean; // מבקר הסימטריה סימן את הערך לבדיקה אנושית
}

// תוצאה מובחנת: או ערך תקין, או סירוב מכובד (נושא מחוץ לתחום).
export type GenerationResult =
  | { refused: false; entry: Entry; meta: GenerationMeta }
  | { refused: true; reason: string };

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new MissingApiKeyError();
  }
  return new Anthropic({ apiKey });
}

interface RawLens {
  name: string;
  family: Lens["family"];
  summary: string;
  body: string;
  grounding: { source: string; explanation: string }[];
  epistemic_type: Lens["epistemicType"];
  confidence?: string;
}
interface RawEntry {
  topic: string;
  topic_kind: Entry["topicKind"];
  refused: boolean;
  refusal_reason?: string;
  lenses: RawLens[];
}

// אכיפת מבחן הביסוס: עדשה עוברת רק אם יש לה grounding אמיתי וגוף ממשי.
function passesGroundingBar(lens: RawLens): boolean {
  return (
    typeof lens.body === "string" &&
    lens.body.trim().length >= MIN_BODY_CHARS &&
    Array.isArray(lens.grounding) &&
    lens.grounding.length > 0 &&
    lens.grounding.every(
      (g) =>
        g &&
        typeof g.source === "string" &&
        g.source.trim().length > 0 &&
        typeof g.explanation === "string" &&
        g.explanation.trim().length > 0
    )
  );
}

// קריאה אחת למודל + פענוח. זורק על stop reasons בעייתיים כדי לאפשר retry.
async function callModel(topic: string): Promise<{ raw: RawEntry; meta: GenerationMeta }> {
  const client = getClient();

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: {
        type: "json_schema",
        schema: ENTRY_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(topic) }],
  } as Anthropic.MessageStreamParams);

  const message = await stream.finalMessage();

  const meta: GenerationMeta = {
    promptVersion: PROMPT_VERSION,
    model: MODEL,
    inputTokens: message.usage?.input_tokens ?? null,
    outputTokens: message.usage?.output_tokens ?? null,
  };

  // טיפול מפורש ב-stop reasons — אחרת נופלים לשגיאה מבלבלת.
  if (message.stop_reason === "max_tokens") {
    throw new Error("truncated: הפלט נקטע (max_tokens).");
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("no_text: המודל לא החזיר תוכן טקסט.");
  }

  let raw: RawEntry;
  try {
    raw = JSON.parse(textBlock.text) as RawEntry;
  } catch {
    throw new Error("parse: המודל החזיר פלט שאינו JSON תקין.");
  }

  return { raw, meta };
}

export async function generateEntry(topic: string): Promise<GenerationResult> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { raw, meta } = await callModel(topic);

      // סירוב מכובד — נושא מחוץ לתחום המוצר.
      if (raw.refused) {
        return {
          refused: true,
          reason:
            raw.refusal_reason?.trim() ||
            "הנושא הזה מחוץ לתחום של perspectipedia.",
        };
      }

      // אכיפת מבחן הביסוס — סינון עדשות ללא ביסוס אמיתי.
      const valid = (raw.lenses ?? []).filter(passesGroundingBar);
      if (valid.length < MIN_LENSES) {
        // לא מספיק עדשות מבוססות — שווה ניסיון נוסף.
        throw new Error("too_few_lenses: לא נוצרו מספיק עדשות מבוססות.");
      }

      // מיון אלפביתי — סדר הצגה ניטרלי (מסיר "המודל שם את המועדף ראשון").
      // ראו docs/BIAS_STRATEGY.md §2.6.
      valid.sort((a, b) => a.name.localeCompare(b.name, "he"));

      const lenses: Lens[] = valid.map((l) => ({
        name: l.name,
        family: l.family,
        summary: l.summary,
        body: l.body,
        grounding: l.grounding,
        epistemicType: l.epistemic_type,
        confidence: l.confidence,
      }));

      const entry: Entry = {
        slug: topicToSlug(topic),
        topic: raw.topic || topic,
        topicKind: raw.topic_kind,
        lenses,
      };

      // מבקר הסימטריה האדוורסרי (flag-gated). verdict שאינו pass → סימון לבדיקה.
      // TODO(v1.1): סבב תיקון אחד לפי ה-flags (דורש מפתח + eval לכיול).
      if (isAuditEnabled()) {
        const audit = await runAudit(entry);
        if (audit && audit.verdict !== "pass") {
          meta.needsReview = true;
        }
      }

      return { refused: false, meta, entry };
    } catch (err) {
      lastErr = err;
      // MissingApiKey לא ניתן לתיקון ב-retry — זרוק מיד.
      if (err instanceof MissingApiKeyError) throw err;
      if (attempt < MAX_ATTEMPTS) continue;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("יצירת הערך נכשלה.");
}
