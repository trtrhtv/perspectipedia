import { prisma } from "./db";
import { generateEntry } from "./claude";
import { topicToSlug } from "./slug";
import type { Entry, Lens } from "./types";

// שליפת ערך קיים מהמסד לפי slug (אם קיים)
export async function getEntryBySlug(slug: string): Promise<Entry | null> {
  const row = await prisma.entry.findUnique({
    where: { slug },
    include: { lenses: { orderBy: { order: "asc" } } },
  });
  if (!row) return null;

  return {
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
  };
}

// שמירת ערך שנוצר
async function persistEntry(entry: Entry): Promise<void> {
  await prisma.entry.create({
    data: {
      slug: entry.slug,
      topic: entry.topic,
      topicKind: entry.topicKind,
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
}

// לולאת הליבה: נושא → cache check → generate → persist → return
export async function getOrCreateEntry(topic: string): Promise<Entry> {
  const slug = topicToSlug(topic);

  // 1. cache check — אם קיים, מוגש מיד ובעקביות.
  const existing = await getEntryBySlug(slug);
  if (existing) return existing;

  // 2. generate — מנוע ה-LLM.
  const entry = await generateEntry(topic);

  // 3. persist — נצבר לספרייה. מטפל במרוץ (אם נוצר במקביל).
  try {
    await persistEntry(entry);
  } catch {
    const raced = await getEntryBySlug(slug);
    if (raced) return raced;
  }

  return entry;
}
