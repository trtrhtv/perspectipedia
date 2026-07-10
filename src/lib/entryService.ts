import { prisma } from "./db";
import { generateEntry } from "./claude";
import { topicToSlug } from "./slug";
import type { Entry, Lens } from "./types";

// מכסת יצירות יומית גלובלית — חוסמת abuse בנפח (ראו docs/ROADMAP.md §5).
const GEN_DAILY_CAP = Number(process.env.GEN_DAILY_CAP ?? "100");

// תוצאה מובחנת של get-or-create.
export type EntryResult =
  | { kind: "entry"; entry: Entry }
  | { kind: "refused"; reason: string }
  | { kind: "pending_review" } // מוחזק לסקירת הוגנות — התוכן לא נחשף
  | { kind: "removed" } // הוסר על ידי מפעיל — ה-slug נשאר תפוס
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
async function fetchBySlug(slug: string): Promise<EntryResult | null> {
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
  const res = await fetchBySlug(slug);
  return res?.kind === "entry" ? res.entry : null;
}

async function countGenerationsToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.entry.count({ where: { createdAt: { gte: start } } });
}

// לולאת הליבה: נושא → cache → cap → generate → persist → return
export async function getOrCreateEntry(topic: string): Promise<EntryResult> {
  const slug = topicToSlug(topic);

  // 1. cache check — כולל ערכים שסורבו.
  const existing = await fetchBySlug(slug);
  if (existing) return existing;

  // 2. מכסה יומית — חוסמת abuse בנפח.
  if (GEN_DAILY_CAP > 0 && (await countGenerationsToday()) >= GEN_DAILY_CAP) {
    return { kind: "capped" };
  }

  // 3. generate — מנוע ה-LLM (מחזיר ערך או סירוב).
  const result = await generateEntry(topic);

  // 4. persist — נצבר לספרייה. מטפל במרוץ (אם נוצר במקביל).
  try {
    if (result.refused) {
      await prisma.entry.create({
        data: {
          slug,
          topic,
          topicKind: "meaning",
          status: "refused",
          refusalReason: result.reason,
        },
      });
      return { kind: "refused", reason: result.reason };
    }

    const { entry, meta } = result;
    await prisma.entry.create({
      data: {
        slug: entry.slug,
        topic: entry.topic,
        topicKind: entry.topicKind,
        // מבקר הסימטריה סימן לבדיקה → מוחזק מהספרייה עד סקירה.
        status: meta.needsReview ? "needs_review" : "published",
        promptVersion: meta.promptVersion,
        model: meta.model,
        inputTokens: meta.inputTokens,
        outputTokens: meta.outputTokens,
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
    return { kind: "entry", entry };
  } catch {
    // מרוץ — אם נוצר במקביל, החזר את מה שקיים.
    const raced = await fetchBySlug(slug);
    if (raced) return raced;
    // אחרת החזר את התוצאה שיצרנו (בלי persist).
    return result.refused
      ? { kind: "refused", reason: result.reason }
      : { kind: "entry", entry: result.entry };
  }
}
