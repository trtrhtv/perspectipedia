import Anthropic from "@anthropic-ai/sdk";
import { ENTRY_JSON_SCHEMA } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import type { Entry, Lens } from "./types";
import { topicToSlug } from "./slug";

// מודל: Claude Opus 4.8 — הכי חזק, קריטי לניואנס ולייצוג מכבד.
const MODEL = "claude-opus-4-8";

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY חסר. הוסף אותו ל-.env.local כדי לאפשר יצירת ערכים.");
    this.name = "MissingApiKeyError";
  }
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new MissingApiKeyError();
  }
  return new Anthropic({ apiKey });
}

// מבנה הפלט הגולמי מהמודל (snake_case, כמו הסכמה)
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
  lenses: RawLens[];
}

// אכיפת מבחן הביסוס: עדשה עוברת רק אם יש לה grounding אמיתי.
function passesGroundingBar(lens: RawLens): boolean {
  return (
    Array.isArray(lens.grounding) &&
    lens.grounding.length > 0 &&
    lens.grounding.every(
      (g) =>
        g &&
        typeof g.source === "string" &&
        g.source.trim().length > 0 &&
        typeof g.explanation === "string" &&
        g.explanation.trim().length > 0
    ) &&
    lens.body?.trim().length > 0
  );
}

export async function generateEntry(topic: string): Promise<Entry> {
  const client = getClient();

  // streaming כדי להימנע מ-timeout על יצירות ארוכות (adaptive thinking + high effort).
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    // effort גבוה לאיכות וניואנס; structured output מבטיח את המבנה.
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

  // הפלט המובנה מגיע כבלוק טקסט שהוא JSON תקין.
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("המודל לא החזיר תוכן טקסט.");
  }

  let raw: RawEntry;
  try {
    raw = JSON.parse(textBlock.text) as RawEntry;
  } catch {
    throw new Error("המודל החזיר פלט שאינו JSON תקין.");
  }

  // אכיפת מבחן הביסוס — סינון עדשות ללא ביסוס אמיתי.
  const validLenses = (raw.lenses ?? []).filter(passesGroundingBar);
  if (validLenses.length === 0) {
    throw new Error("לא נוצרו עדשות מבוססות לנושא הזה.");
  }

  const lenses: Lens[] = validLenses.map((l) => ({
    name: l.name,
    family: l.family,
    summary: l.summary,
    body: l.body,
    grounding: l.grounding,
    epistemicType: l.epistemic_type,
    confidence: l.confidence,
  }));

  return {
    slug: topicToSlug(topic),
    topic: raw.topic || topic,
    topicKind: raw.topic_kind,
    lenses,
  };
}
