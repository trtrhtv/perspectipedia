import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { generateEntry, MissingApiKeyError } from "./claude";
import { topicToSlug, normalizeTopic, heVariantSlug } from "./slug";
import { limitCreate } from "./ratelimit";
import { isGateEnabled, runGate } from "./gate";
import { isMockLlmEnabled } from "./mockLlm";
import type { Entry, Lens } from "./types";

// מכסת יצירות יומית גלובלית — חוסמת abuse בנפח (ראו docs/ROADMAP.md §5).
const GEN_DAILY_CAP = Number(process.env.GEN_DAILY_CAP ?? "100");

// תוצאה מובחנת של get-or-create.
export type EntryResult =
  | { kind: "entry"; entry: Entry }
  | { kind: "refused"; reason: string }
  | { kind: "pending"; slug: string; owned?: boolean } // owned: הבקשה הזו קנתה את המנעול ואחראית לעיבוד
  | { kind: "pending_review" } // מוחזק לסקירת הוגנות — התוכן לא נחשף
  | { kind: "failed"; slug: string } // היצירה נכשלה — אפשר לנסות שוב
  | { kind: "removed" } // הוסר על ידי מפעיל — ה-slug נשאר תפוס
  | { kind: "rate_limited"; retryAfterSeconds?: number } // חריגת יצירות פר-IP
  | { kind: "capped" };

// pending שישן מזה נחשב תקוע — הבקשה הבאה מאמצת אותו (worker מת באמצע).
const PENDING_TIMEOUT_MS = 6 * 60 * 1000;
const MAX_JOB_ATTEMPTS = 3;

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
// עטוף ב-React cache: generateMetadata וגוף הדף חולקים fetch אחד פר-בקשה.
export const getEntryResultBySlug = cache(async function getEntryResultBySlugImpl(
  slug: string
): Promise<EntryResult | null> {
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
  // בתהליך יצירה — הלקוח מציג polling.
  if (row.status === "pending") {
    return { kind: "pending", slug: row.slug };
  }
  // נכשל — מוצג מסך שגיאה עם retry.
  if (row.status === "failed") {
    return { kind: "failed", slug: row.slug };
  }
  // fail-closed: סטטוס עתידי שלא מופה כאן במפורש נשאר מוסתר — לא מוגש כערך מפורסם.
  if (row.status !== "published") {
    return { kind: "removed" };
  }
  return {
    kind: "entry",
    entry: {
      slug: row.slug,
      topic: row.topic,
      topicKind: row.topicKind as Entry["topicKind"],
      crux: row.crux ?? undefined,
      provenance: {
        model: row.model,
        promptVersion: row.promptVersion,
        createdAt: row.createdAt.toISOString(),
      },
      lenses: seededShuffle(row.lenses, row.slug).map((l) => ({
        name: l.name,
        family: l.family as Lens["family"],
        summary: l.summary,
        body: l.body,
        grounding: l.grounding as unknown as Lens["grounding"],
        epistemicType: l.epistemicType as Lens["epistemicType"],
        confidence: l.confidence ?? undefined,
      })),
    },
  };
});

// ערבוב דטרמיניסטי פר-ערך (PRE_KEY 2.1): מיון אלפביתי הוא הטיה שיטתית כלל-אתרית —
// אותה עדשה תמיד ראשונה בכל הערכים. ערבוב שנגזר מה-slug מפזר את יתרון-המיקום בין
// ערכים, ונשאר יציב לחלוטין לאותו ערך (אותו סדר בכל טעינה, cache-friendly).
function seededShuffle<T>(items: T[], seedText: string): T[] {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  const rand = () => {
    // mulberry32
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
  // המכסה מגינה על תקציב ה-Opus — סירובי-שער (Haiku, בלי טוקני Opus) לא נספרים,
  // אחרת 100 נושאי-זבל זולים מקפיאים את היצירה לכולם (ממצא ביקורת).
  return prisma.entry.count({
    where: {
      createdAt: { gte: start },
      NOT: { status: "refused", outputTokens: null },
    },
  });
}

// לולאת הליבה (PLAN 5.1): נושא → cache → הגנות → job-row (מנעול) → 202.
// העבודה הכבדה רצה ב-processPendingEntry — מי שקנה את המנעול מפעיל אותה.
// requestGeneration מחזיר מהר; הלקוח עוקב ב-polling על GET /api/entry/[slug].
export async function getOrCreateEntry(
  topic: string,
  opts: { ip?: string; depth?: "summary" | "standard" } = {}
): Promise<EntryResult> {
  const cleanTopic = normalizeTopic(topic);
  const slug = topicToSlug(cleanTopic);

  // 1. cache check — כולל alias ווריאנט ה"א (PLAN 1.5א). ערכים קיימים בלי rate limit.
  const canonical = await resolveExistingSlug(slug);
  if (canonical) {
    const existing = await getEntryResultBySlug(canonical);
    if (existing) {
      // pending תקוע — ה-worker כנראה מת. הבקשה הזו מאמצת את השורה ומנסה שוב.
      if (existing.kind === "pending") {
        const adopted = await tryAdoptStuckPending(canonical);
        if (adopted) return { kind: "pending", slug: canonical, owned: true };
      }
      // failed — ניסיון חוזר מפורש (עובר rate limit כדי שלא ילחצו בלופ).
      if (existing.kind === "failed") {
        const rl = await limitCreate(opts.ip ?? "unknown");
        if (!rl.allowed) {
          return { kind: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds };
        }
        const revived = await tryReviveFailed(canonical);
        if (revived) return { kind: "pending", slug: canonical, owned: true };
      }
      return existing;
    }
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

  // 5. אין מפתח → 503 נקי לפני שנוצרת שורת pending שאין מי שיעבד אותה.
  // (במצב MOCK_LLM אין צורך במפתח — הצנרת רצה עם מודל-דמה.)
  if (!process.env.ANTHROPIC_API_KEY?.trim() && !isMockLlmEnabled()) {
    throw new MissingApiKeyError();
  }

  // 6. job-row: ה-insert של שורת pending הוא קניית המנעול (unique slug = mutex).
  try {
    await prisma.entry.create({
      data: {
        slug,
        topic: cleanTopic,
        topicKind: "meaning", // placeholder — מתעדכן בסוף היצירה
        status: "pending",
        // בחירת הקורא (D7): נשמרת עכשיו, נאכפת ביצירה מחוקה v3 (PLAN 4.7).
        depth: opts.depth ?? "standard",
        generationStartedAt: new Date(),
        attemptCount: 1,
      },
    });
  } catch (err) {
    // רק התנגשות unique (P2002) היא מרוץ אמיתי — מישהו אחר קנה את המנעול.
    // כל שגיאה אחרת (נפילת חיבור, pool) חייבת להתפוצץ — אחרת מחזירים 202
    // על שורה שלא קיימת והלקוח יעשה polling לנצח (ממצא ביקורת).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { kind: "pending", slug, owned: false };
    }
    throw err;
  }

  return { kind: "pending", slug, owned: true };
}

// אימוץ pending תקוע: עדכון אטומי שמצליח רק אם ה-timeout באמת עבר (מונע אימוץ כפול).
async function tryAdoptStuckPending(slug: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - PENDING_TIMEOUT_MS);
  const res = await prisma.entry.updateMany({
    where: {
      slug,
      status: "pending",
      generationStartedAt: { lt: cutoff },
      attemptCount: { lt: MAX_JOB_ATTEMPTS },
    },
    data: { generationStartedAt: new Date(), attemptCount: { increment: 1 } },
  });
  if (res.count === 0) {
    // תקוע מעבר לתקרת הניסיונות → failed (אחרת יתקע לנצח).
    await prisma.entry.updateMany({
      where: {
        slug,
        status: "pending",
        generationStartedAt: { lt: cutoff },
        attemptCount: { gte: MAX_JOB_ATTEMPTS },
      },
      data: { status: "failed", lastError: "timeout: היצירה נתקעה שוב ושוב." },
    });
    return false;
  }
  return true;
}

// החייאת failed לניסיון נוסף (כפתור "נסו שוב" / admin).
async function tryReviveFailed(slug: string): Promise<boolean> {
  const res = await prisma.entry.updateMany({
    where: { slug, status: "failed" },
    data: {
      status: "pending",
      generationStartedAt: new Date(),
      attemptCount: { increment: 1 },
      lastError: null,
    },
  });
  return res.count > 0;
}

// ה-worker (seam ל-queue חיצוני, ARCHITECTURE_TARGET §7): מעבד שורת pending אחת.
// היום נקרא מאותה בקשה שקנתה את המנעול (דרך after()); מחר — מ-cron/queue, בלי שינוי.
//
// כל מעברי המצב מותנים ב-status="pending" (updateMany עם guard): worker כפול
// (adoption של שורה שנחשבה תקועה) או admin שהסיר את הערך תוך כדי יצירה —
// לא דורסים תוצאה שכבר נקבעה (ממצא ביקורת).
export async function processPendingEntry(slug: string): Promise<void> {
  let result: Awaited<ReturnType<typeof generateEntry>> | null = null;
  let attempt = 0;
  try {
    const row = await prisma.entry.findUnique({ where: { slug } });
    if (!row || row.status !== "pending") return; // כבר טופל / נמחק
    attempt = row.attemptCount;

    result = await generateEntry(row.topic);

    if (result.refused) {
      const updated = await prisma.entry.updateMany({
        where: { slug, status: "pending" },
        data: {
          status: "refused",
          refusalReason: result.reason,
          // גם סירוב עלה כסף — נרשם לחשבונאות ול-post-mortem (ממצא ביקורת).
          model: result.meta?.model,
          promptVersion: result.meta?.promptVersion,
          inputTokens: result.meta?.inputTokens,
          outputTokens: result.meta?.outputTokens,
          costUsd: result.meta?.costUsd,
          rawOutput: result.meta?.rawOutput,
        },
      });
      logGeneration({ slug, finalStatus: "refused", costUsd: result.meta?.costUsd ?? null, skipped: updated.count === 0 });
      return;
    }

    const { entry, meta } = result;
    const finalStatus = meta.needsReview ? "needs_review" : "published";
    // טרנזקציה אינטראקטיבית: קודם קניית המעבר (guard על pending), רק אז החלפת עדשות.
    const persisted = await prisma.$transaction(async (tx) => {
      const claimed = await tx.entry.updateMany({
        where: { slug, status: "pending" },
        data: {
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
          auditVerdict: meta.auditVerdict ?? null,
          auditJson: (meta.auditJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          lastError: null,
        },
      });
      if (claimed.count === 0) return false; // המצב השתנה תחתינו — לא נוגעים
      await tx.lens.deleteMany({ where: { entryId: row.id } });
      await tx.lens.createMany({
        data: entry.lenses.map((l, i) => ({
          entryId: row.id,
          name: l.name,
          family: l.family,
          summary: l.summary,
          body: l.body,
          // Prisma Json input — מערך טיפוסי דורש המרה מפורשת
          grounding: l.grounding as unknown as Prisma.InputJsonValue,
          epistemicType: l.epistemicType,
          confidence: l.confidence,
          order: i,
        })),
      });
      return true;
    });
    logGeneration({
      slug,
      model: meta.model,
      promptVersion: meta.promptVersion,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      costUsd: meta.costUsd,
      durationMs: meta.durationMs,
      lensCount: entry.lenses.length,
      attempt,
      finalStatus: persisted ? finalStatus : "skipped_state_changed",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה לא מזוהה";
    // שימור הפלט ששולם עליו גם בכשל persist — post-mortem בלי לשלם שוב.
    const rawOutput = result && !result.refused ? result.meta.rawOutput : null;
    await prisma.entry
      .updateMany({
        where: { slug, status: "pending" },
        data: { status: "failed", lastError: message, ...(rawOutput ? { rawOutput } : {}) },
      })
      .catch(() => null);
    logGeneration({ slug, finalStatus: "failed", error: message, attempt });
  }
}
