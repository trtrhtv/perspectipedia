import { prisma } from "./db";
import { generateEntry } from "./claude";
import { topicToSlug, normalizeTopic, heVariantSlug } from "./slug";
import { limitCreate } from "./ratelimit";
import { isGateEnabled, runGate } from "./gate";
import type { Entry, Lens } from "./types";

// מכסת יצירות יומית גלובלית — חוסמת abuse בנפח (ראו docs/ROADMAP.md §5).
const GEN_DAILY_CAP = Number(process.env.GEN_DAILY_CAP ?? "100");

// תוצאה מובחנת של get-or-create.
export type EntryResult =
  | { kind: "entry"; entry: Entry }
  | { kind: "refused"; reason: string }
  | { kind: "pending_review" } // מוחזק לסקירת הוגנות — התוכן לא נחשף
  | { kind: "removed" } // הוסר על ידי מפעיל — ה-slug נשאר תפוס
  | { kind: "rate_limited"; retryAfterSeconds?: number } // חריגת יצירות פר-IP
  | { kind: "capped" };

export interface EntrySummary {
  slug: string;
  topic: string;
  topicKind: Entry["topicKind"];
  lensNames: string[];
  createdAt: Date;
}

// רשימת הערכים שפורסמו — לספריית הערכים (לא כולל refused/removed).
export async function listEntries(): Promise<EntrySummary[]> {
  const rows = await prisma.entry.findMany({
    where: { status: "published" },
    orderBy: { createdAt: "desc" },
    include: { lenses: { orderBy: { order: "asc" }, select: { name: true } } },
  });
  return rows.map((r) => ({
    slug: r.slug,
    topic: r.topic,
    topicKind: r.topicKind as Entry["topicKind"],
    lensNames: r.lenses.map((l) => l.name),
    createdAt: r.createdAt,
  }));
}

// שליפת ערך קיים מהמסד לפי slug — מחזיר גם ערכים שסורבו (כדי לא לייצר שוב).
// משמש גם את דף הערך (SSR): הדף מציג כל מצב לפי ה-kind, בלי לייצר.
export async function getEntryResultBySlug(slug: string): Promise<EntryResult | null> {
  const row = await prisma.entry.findUnique({
    where: { slug },
    include: { lenses: { orderBy: { order: "asc" } } },
  });
  if (!row) return null;
  if (row.status === "refused") {
    return { kind: "refused", reason: row.refusalReason ?? "הנושא מחוץ לתחום." };
  }
  // מוחזק לסקירה — לא חושפים תוכן בשום מסלול ציבורי (גם לא URL ישיר).
  if (row.status === "needs_review") {
    return { kind: "pending_review" };
  }
  // הוסר — ה-slug תפוס (לא מייצרים מחדש), אבל אין מה להציג.
  if (row.status === "removed") {
    return { kind: "removed" };
  }
  return {
    kind: "entry",
    entry: {
      slug: row.slug,
      topic: row.topic,
      topicKind: row.topicKind as Entry["topicKind"],
      lenses: row.lenses.map((l) => ({
        name: l.name,
        family: l.family as Lens["family"],
        summary: l.summary,
        body: l.body,
        grounding: JSON.parse(l.grounding) as Lens["grounding"],
        epistemicType: l.epistemicType as Lens["epistemicType"],
        confidence: l.confidence ?? undefined,
      })),
    },
  };
}

// גרסה ציבורית — שליפה בלבד (ל-server rendering של ערך קיים).
export async function getEntryBySlug(slug: string): Promise<Entry | null> {
  const res = await getEntryResultBySlug(slug);
  return res?.kind === "entry" ? res.entry : null;
}

// פתרון slug לערך קיים (PLAN 1.5א): התאמה מדויקת → alias → וריאנט ה"א-הידיעה.
// מחזיר את ה-slug הקנוני של הערך אם קיים, אחרת null.
export async function resolveExistingSlug(slug: string): Promise<string | null> {
  // 1. התאמה מדויקת — תמיד גוברת.
  const exact = await prisma.entry.findUnique({ where: { slug }, select: { slug: true } });
  if (exact) return exact.slug;

  // 2. טבלת aliases.
  const alias = await prisma.topicAlias.findUnique({
    where: { alias: slug },
    select: { entry: { select: { slug: true } } },
  });
  if (alias) return alias.entry.slug;

  // 3. וריאנט ה"א-הידיעה ("השואה" ↔ "שואה") — כערך או כ-alias.
  const variant = heVariantSlug(slug);
  if (variant) {
    const varEntry = await prisma.entry.findUnique({
      where: { slug: variant },
      select: { id: true, slug: true },
    });
    if (varEntry) {
      // רישום עצלן — הפעם הבאה תפגע ישירות בטבלת ה-aliases.
      await prisma.topicAlias
        .create({ data: { alias: slug, entryId: varEntry.id, source: "deterministic" } })
        .catch(() => null); // מרוץ על unique — לא קריטי
      return varEntry.slug;
    }
    const varAlias = await prisma.topicAlias.findUnique({
      where: { alias: variant },
      select: { entry: { select: { slug: true } } },
    });
    if (varAlias) return varAlias.entry.slug;
  }

  return null;
}

// שורת לוג מובנית אחת לכל יצירה — observability של usage/עלות (PLAN 0.4).
function logGeneration(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: "generation", ...fields }));
}

async function countGenerationsToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.entry.count({ where: { createdAt: { gte: start } } });
}

// לולאת הליבה: נושא → cache → rate limit → cap → generate → persist → return
export async function getOrCreateEntry(
  topic: string,
  opts: { ip?: string } = {}
): Promise<EntryResult> {
  const cleanTopic = normalizeTopic(topic);
  const slug = topicToSlug(cleanTopic);

  // 1. cache check — כולל alias ווריאנט ה"א (PLAN 1.5א). ערכים קיימים בלי rate limit.
  const canonical = await resolveExistingSlug(slug);
  if (canonical) {
    const existing = await getEntryResultBySlug(canonical);
    if (existing) return existing;
  }

  // 2. rate limit פר-IP — רק יצירה חדשה נספרת (PLAN 1.1).
  const rl = await limitCreate(opts.ip ?? "unknown");
  if (!rl.allowed) {
    return { kind: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds };
  }

  // 3. מכסה יומית — קו הגנה שני, חוסמת abuse בנפח כולל.
  if (GEN_DAILY_CAP > 0 && (await countGenerationsToday()) >= GEN_DAILY_CAP) {
    return { kind: "capped" };
  }

  // 4. שער-נושא (Haiku, flag-gated) — סירוב זול לפני שקריאת Opus יקרה יוצאת (PLAN 1.2).
  if (isGateEnabled()) {
    const gate = await runGate(cleanTopic);
    if (gate?.decision === "refuse") {
      const reason = gate.reason ?? "הנושא הזה מחוץ לתחום של perspectipedia.";
      // סירוב-שער נשמר כשורת refused — blocklist זול, אותו מנגנון קיים.
      await prisma.entry
        .create({
          data: { slug, topic: cleanTopic, topicKind: "meaning", status: "refused", refusalReason: reason },
        })
        .catch(() => null); // מרוץ על unique — לא קריטי
      logGeneration({ slug, finalStatus: "refused", gate: "refuse", costUsd: gate.costUsd });
      return { kind: "refused", reason };
    }
  }

  // 5. generate — מנוע ה-LLM (מחזיר ערך או סירוב). הנושא המנורמל בלבד.
  const result = await generateEntry(cleanTopic);

  // 4. persist — נצבר לספרייה. מטפל במרוץ (אם נוצר במקביל).
  try {
    if (result.refused) {
      await prisma.entry.create({
        data: {
          slug,
          topic: cleanTopic,
          topicKind: "meaning",
          status: "refused",
          refusalReason: result.reason,
        },
      });
      logGeneration({ slug, finalStatus: "refused" });
      return { kind: "refused", reason: result.reason };
    }

    const { entry, meta } = result;
    const finalStatus = meta.needsReview ? "needs_review" : "published";
    await prisma.entry.create({
      data: {
        slug: entry.slug,
        topic: entry.topic,
        topicKind: entry.topicKind,
        // מבקר הסימטריה סימן לבדיקה → מוחזק מהספרייה עד סקירה.
        status: finalStatus,
        promptVersion: meta.promptVersion,
        model: meta.model,
        inputTokens: meta.inputTokens,
        outputTokens: meta.outputTokens,
        costUsd: meta.costUsd,
        rawOutput: meta.rawOutput,
        lenses: {
          create: entry.lenses.map((l, i) => ({
            name: l.name,
            family: l.family,
            summary: l.summary,
            body: l.body,
            grounding: JSON.stringify(l.grounding),
            epistemicType: l.epistemicType,
            confidence: l.confidence,
            order: i,
          })),
        },
      },
    });
    logGeneration({
      slug: entry.slug,
      model: meta.model,
      promptVersion: meta.promptVersion,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      costUsd: meta.costUsd,
      durationMs: meta.durationMs,
      lensCount: entry.lenses.length,
      finalStatus,
    });
    return { kind: "entry", entry };
  } catch {
    // מרוץ — אם נוצר במקביל, החזר את מה שקיים.
    const raced = await getEntryResultBySlug(slug);
    if (raced) return raced;
    // אחרת החזר את התוצאה שיצרנו (בלי persist).
    return result.refused
      ? { kind: "refused", reason: result.reason }
      : { kind: "entry", entry: result.entry };
  }
}
