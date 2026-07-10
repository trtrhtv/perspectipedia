// בדיקת זמינות מקורות מקושרים (PLAN 4.2) — רץ ידנית/CI לפני פרסום קורפוס.
// עובר על כל פריטי ה-grounding עם url ובודק שהקישור חי (HEAD, ואם נחסם — GET).
// שימוש: node scripts/check-links.mjs [--slug <slug>]
// רשת בלבד — אפס קריאות Anthropic.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TIMEOUT_MS = 15_000;
const onlySlug = process.argv.includes("--slug")
  ? process.argv[process.argv.indexOf("--slug") + 1]
  : null;

// סיווג: ok (חי) / blocked (WAF חוסם בוטים — 403/405/429, כנראה חי) / broken (מת).
async function checkUrl(url) {
  const BLOCKED = new Set([401, 403, 405, 429]);
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          // UA דפדפני — חלק מהאתרים (כולל ספריא) חוסמים UA של סקריפטים
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
      });
      if (res.ok) return { verdict: "ok", status: res.status };
      // חלק מהאתרים מחזירים 403/405 ל-HEAD אבל עובדים ב-GET — לכן הלולאה.
      if (method === "GET") {
        return { verdict: BLOCKED.has(res.status) ? "blocked" : "broken", status: res.status };
      }
    } catch (err) {
      if (method === "GET") return { verdict: "broken", error: err?.cause?.code ?? err.name };
    }
  }
  return { verdict: "broken" };
}

const entries = await prisma.entry.findMany({
  where: onlySlug ? { slug: onlySlug } : { status: "published" },
  select: { slug: true, lenses: { select: { name: true, grounding: true } } },
});

let total = 0;
let linked = 0;
let broken = 0;
let blocked = 0;

for (const entry of entries) {
  for (const lens of entry.lenses) {
    const items = Array.isArray(lens.grounding) ? lens.grounding : [];
    for (const g of items) {
      total++;
      if (!g.url) continue;
      linked++;
      const res = await checkUrl(g.url);
      if (res.verdict === "broken") {
        broken++;
        console.log(
          `BROKEN  ${entry.slug} · ${lens.name} · ${g.source}\n        ${g.url} → ${res.status ?? res.error ?? "?"}`
        );
      } else if (res.verdict === "blocked") {
        blocked++;
        console.log(`warn    ${entry.slug} · ${g.url} → ${res.status} (חסום לבוטים — לבדוק ידנית)`);
      } else {
        console.log(`ok      ${entry.slug} · ${g.url}`);
      }
    }
  }
}

console.log(
  `\nsummary: ${total} sources, ${linked} linked (${total ? Math.round((linked / total) * 100) : 0}%), ${blocked} blocked (verify manually), ${broken} broken`
);
await prisma.$disconnect();
process.exit(broken > 0 ? 1 : 0);
