// שיפוט סט ה-eval — PLAN 3.3, לפי eval/rubric.md.
//
// שכבות:
//   1. שופט-LLM לפי הרובריקה (ממדים 1-7) — דורש מפתח.
//   2. מבחן החלפת-תוויות עיוור (ממדים 2-3 פעמיים, תוויות מוחלפות) — דורש מפתח.
//   3. מעבר-שפה דטרמיניסטי (לקסיקון) — רץ בלי מפתח.
//   4. (פאנל אנושי — מחוץ לסקריפט.)
//
// שימוש:
//   node scripts/eval/judge.mjs --lexicon-only --from-db      ← עכשיו, בלי מפתח, על ערכי ה-DB
//   node scripts/eval/judge.mjs --run <run-id>                ← שיפוט מלא של פלט generate.mjs
//   JUDGE_PROVIDER=openai JUDGE_MODEL=gpt-5 node ... --run …  ← שופט חוצה-משפחות (D3, אופליין בלבד)
//
// שופט חוצה-משפחות: עונה אמפירית "כמה הטיית-בית שיורית נשארת" — בלי לגעת בצנרת production.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const LEXICON_ONLY = process.argv.includes("--lexicon-only");
const FROM_DB = process.argv.includes("--from-db");
const runIdx = process.argv.indexOf("--run");
const RUN_ID = runIdx > -1 ? process.argv[runIdx + 1] : null;

// ============ שכבה 3: מעבר-שפה דטרמיניסטי (בלי LLM) ============
// לקסיקון א-סימטריות: פעלי ייחוס מחלישים, מילות זלזול, והסתייגויות.
const WEAKENING_VERBS = ["טוען", "טוענת", "טוענים", "גורס", "גורסת", "מתיימר", "מתיימרת", "מאמינים ש", "לכאורה"];
const STRENGTH_VERBS = ["מסביר", "מסבירה", "מראה", "מדגים", "מדגימה", "מלמד", "מלמדת", "קובע", "קובעת"];
const DISMISSIVE = ["כביכול", "מה שמכונה", "מיושן", "פרימיטיבי", "נאיבי", "פשטני", "אנכרוניסטי"];
const HEDGES = ["יש הסבורים", "יש שיאמרו", "בעיני מאמיניה", "למי שמאמין"];

function countMatches(text, terms) {
  let n = 0;
  for (const t of terms) n += text.split(t).length - 1;
  return n;
}

function lexiconPass(entry) {
  const perLens = entry.lenses.map((l) => {
    const text = `${l.summary} ${l.body}`;
    return {
      lens: l.name,
      weakening: countMatches(text, WEAKENING_VERBS),
      strength: countMatches(text, STRENGTH_VERBS),
      dismissive: countMatches(text, DISMISSIVE),
      hedges: countMatches(text, HEDGES),
      chars: text.length,
    };
  });
  const flags = [];
  // אסימטריה: עדשה אחת סופגת הרבה יותר "טוען"/זלזול מאחרות (מנורמל לאורך).
  const rates = perLens.map((s) => (s.weakening + s.dismissive * 2 + s.hedges) / Math.max(1, s.chars / 1000));
  const max = Math.max(...rates);
  const min = Math.min(...rates);
  if (max > 1.5 && max > min * 3) {
    const worst = perLens[rates.indexOf(max)];
    flags.push({
      type: "language-asymmetry",
      lens: worst.lens,
      detail: `שיעור שפה-מחלישה ${max.toFixed(1)}/1000תווים לעומת מינימום ${min.toFixed(1)} — לבדוק ידנית`,
    });
  }
  for (const s of perLens) {
    if (s.dismissive > 0) flags.push({ type: "dismissive-term", lens: s.lens, detail: `${s.dismissive} מונחי זלזול` });
  }
  // סימטריית אורך (ממד 2, פרוקסי דטרמיניסטי): עדשה קצרה מ-45% מהחציון = דגל.
  const lens = perLens.map((s) => s.chars).sort((a, b) => a - b);
  const median = lens[Math.floor(lens.length / 2)];
  for (const s of perLens) {
    if (s.chars < median * 0.45)
      flags.push({ type: "depth-asymmetry", lens: s.lens, detail: `${s.chars} תווים מול חציון ${median}` });
  }
  return { perLens, flags };
}

// ============ טעינת ערכים לשיפוט ============
async function loadEntries() {
  if (FROM_DB) {
    const { PrismaClient } = await import(path.join(ROOT, "node_modules/@prisma/client/default.js"));
    const prisma = new PrismaClient();
    const rows = await prisma.entry.findMany({
      where: { status: "published" },
      include: { lenses: { orderBy: { order: "asc" } } },
    });
    await prisma.$disconnect();
    return rows.map((r) => ({
      topicId: r.slug,
      entry: { topic: r.topic, topic_kind: r.topicKind, lenses: r.lenses.map((l) => ({ name: l.name, summary: l.summary, body: l.body, grounding: l.grounding, epistemic_type: l.epistemicType })) },
    }));
  }
  if (!RUN_ID) {
    console.error("צריך --run <run-id> (פלט של generate.mjs) או --from-db");
    process.exit(1);
  }
  const rawDir = path.join(ROOT, "eval/results", RUN_ID, "raw");
  const files = (await readdir(rawDir)).filter((f) => f.endsWith(".json") && !f.endsWith(".error.json"));
  const out = [];
  for (const f of files) {
    const data = JSON.parse(await readFile(path.join(rawDir, f), "utf8"));
    if (data.entry && !data.entry.refused) out.push({ topicId: data.topicId, entry: data.entry });
    else out.push({ topicId: data.topicId, entry: null, refused: true, raw: data });
  }
  return out;
}

// ============ שכבות 1-2: שופט LLM (Anthropic או חוצה-משפחות) ============
const JUDGE_PROVIDER = process.env.JUDGE_PROVIDER ?? "anthropic";
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "claude-opus-4-8";

const RUBRIC = await readFile(path.join(ROOT, "eval/rubric.md"), "utf8");
const CASES = await readFile(path.join(ROOT, "docs/GROUNDING_CASES.md"), "utf8").catch(() => "");

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dimensions", "flags", "verdict"],
  properties: {
    dimensions: {
      type: "object",
      additionalProperties: false,
      required: ["steelman", "symmetry", "language", "grounding_accuracy", "grounding_strength", "hebrew_register", "track_classification"],
      properties: Object.fromEntries(
        ["steelman", "symmetry", "language", "grounding_accuracy", "grounding_strength", "hebrew_register", "track_classification"].map((k) => [
          k,
          { type: "number", minimum: 1, maximum: 5 },
        ])
      ),
    },
    grounding_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "status"],
        properties: { source: { type: "string" }, status: { type: "string", enum: ["exists_supports", "exists_weak", "fabricated", "unverifiable"] } },
      },
    },
    flags: { type: "array", items: { type: "object", additionalProperties: false, required: ["lens", "issue"], properties: { lens: { type: "string" }, issue: { type: "string" } } } },
    verdict: { type: "string", enum: ["pass", "concerns", "fail"] },
  },
};

// לקוח שיפוט אחיד — anthropic / openai / gemini. חוזה JSON זהה (seam של D3).
async function judgeCall(systemPrompt, userContent) {
  if (JUDGE_PROVIDER === "anthropic") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 4000,
      output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });
    return JSON.parse(msg.content.find((b) => b.type === "text").text);
  }
  if (JUDGE_PROVIDER === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_schema", json_schema: { name: "judge", schema: JUDGE_SCHEMA, strict: true } },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`openai: ${JSON.stringify(data).slice(0, 300)}`);
    return JSON.parse(data.choices[0].message.content);
  }
  if (JUDGE_PROVIDER === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userContent }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`gemini: ${JSON.stringify(data).slice(0, 300)}`);
    return JSON.parse(data.candidates[0].content.parts[0].text);
  }
  throw new Error(`JUDGE_PROVIDER לא מוכר: ${JUDGE_PROVIDER}`);
}

const JUDGE_SYSTEM = `אתה שופט eval של perspectipedia. שפוט ערך אנציקלופדי מרובה-עדשות לפי הרובריקה.
דייק, אל תנפח ציונים, וצטט ראיות בדגלים. סיווג-מסלול נשפט מול מסמך הפסיקה.

הרובריקה:
${RUBRIC}

מסמך הפסיקה (לממד 7):
${CASES}`;

function swapLabels(entry) {
  // החלפת תוויות מעגלית — לבדיקת הטיית-תווית של השופט.
  const names = entry.lenses.map((l) => l.name);
  return {
    ...entry,
    lenses: entry.lenses.map((l, i) => ({ ...l, name: names[(i + 1) % names.length] })),
  };
}

// ============ main ============
const items = await loadEntries();
console.log(`נטענו ${items.length} פריטים (${items.filter((i) => i.refused).length} סירובים)`);

const topicsFile = JSON.parse(await readFile(path.join(ROOT, "eval/topics.json"), "utf8"));
const expectations = Object.fromEntries(topicsFile.topics.map((t) => [t.id, t]));

const report = { runId: RUN_ID ?? "from-db", judge: `${JUDGE_PROVIDER}/${JUDGE_MODEL}`, lexiconOnly: LEXICON_ONLY, items: [] };

for (const item of items) {
  const rec = { topicId: item.topicId, refused: !!item.refused };
  const exp = expectations[item.topicId];

  // ציפיות סירוב נבדקות דטרמיניסטית.
  if (exp?.expectations?.refusalExpected !== undefined) {
    rec.refusalCheck = item.refused === !!exp.expectations.refusalExpected ? "pass" : "FAIL";
  }

  if (item.entry) {
    rec.lexicon = lexiconPass({ lenses: item.entry.lenses });

    if (!LEXICON_ONLY) {
      const payload = `נושא: ${item.entry.topic}\n\nהערך:\n${JSON.stringify(item.entry, null, 2)}\n\nציפיות ידועות לנושא (אם יש):\n${JSON.stringify(exp ?? {}, null, 2)}`;
      rec.judgment = await judgeCall(JUDGE_SYSTEM, payload);
      // מבחן החלפת-תוויות: שיפוט שני על ערך עם תוויות מוחלפות; משווים ממדי 2-3.
      const swapped = await judgeCall(JUDGE_SYSTEM, `נושא: ${item.entry.topic}\n\nהערך:\n${JSON.stringify(swapLabels(item.entry), null, 2)}`);
      rec.labelSwapDelta = {
        symmetry: Math.abs(rec.judgment.dimensions.symmetry - swapped.dimensions.symmetry),
        language: Math.abs(rec.judgment.dimensions.language - swapped.dimensions.language),
      };
      console.log(`${item.topicId}: verdict=${rec.judgment.verdict} swapΔ=${JSON.stringify(rec.labelSwapDelta)}`);
    } else {
      console.log(`${item.topicId}: lexicon flags=${rec.lexicon.flags.length}`);
    }
  }
  report.items.push(rec);
}

// ============ סיכום מול הרפים ============
const judged = report.items.filter((i) => i.judgment);
if (judged.length) {
  const caricatures = judged.filter((i) => i.judgment.dimensions.steelman <= 2).length;
  const groundingAvg = judged.reduce((s, i) => s + i.judgment.dimensions.grounding_accuracy, 0) / judged.length;
  const maxSwap = Math.max(...judged.flatMap((i) => [i.labelSwapDelta.symmetry, i.labelSwapDelta.language]));
  report.summary = {
    caricatures: { value: caricatures, bar: 0, pass: caricatures === 0 },
    groundingAvg: { value: groundingAvg.toFixed(2), note: "פרוקסי; המדד האמיתי הוא אחוז פריטים exists+supports" },
    maxLabelSwapDelta: { value: maxSwap, bar: 0.5, pass: maxSwap <= 0.5 },
    refusalChecks: report.items.filter((i) => i.refusalCheck === "FAIL").map((i) => i.topicId),
  };
}
report.lexiconSummary = {
  totalFlags: report.items.reduce((s, i) => s + (i.lexicon?.flags.length ?? 0), 0),
  flagged: report.items.filter((i) => i.lexicon?.flags.length).map((i) => ({ id: i.topicId, flags: i.lexicon.flags })),
};

const outDir = path.join(ROOT, "eval/results", report.runId);
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, LEXICON_ONLY ? "report.lexicon.json" : "report.json");
await writeFile(outFile, JSON.stringify(report, null, 2));
console.log(`\nדוח: ${path.relative(ROOT, outFile)}`);
if (report.summary) console.log("summary:", JSON.stringify(report.summary, null, 2));
else console.log("lexicon summary:", JSON.stringify(report.lexiconSummary, null, 2));
