// יצירת סט ה-eval דרך Batch API (50% הנחה) — PLAN 3.3.
//
// שימוש:
//   node scripts/eval/generate.mjs --dry-run      ← בלי מפתח: ולידציה + קובץ בקשות
//   node scripts/eval/generate.mjs                ← עם מפתח: שיגור batch, polling, שמירת פלט גולמי
//   node scripts/eval/generate.mjs --batch <id>   ← המשך polling של batch קיים
//
// הפלט: eval/results/<run-id>/raw/<topic-id>.json — נצרך ע"י judge.mjs.
// החוקה והסכמה מיובאות מ-src/lib (מקור אמת אחד). דורש node --experimental-strip-types?
// לא — מריצים דרך ה-wrapper: הקובץ הזה נטען עם הדגל אוטומטית (ראו תחתית package.json).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const DRY = process.argv.includes("--dry-run");
const batchArgIdx = process.argv.indexOf("--batch");
const RESUME_BATCH = batchArgIdx > -1 ? process.argv[batchArgIdx + 1] : null;

// ייבוא החוקה + הסכמה מקוד המקור (strip-types — אין לוגיקה, רק consts).
const { SYSTEM_PROMPT, PROMPT_VERSION, buildUserPrompt } = await import(
  path.join(ROOT, "src/lib/prompts.ts")
);
const { ENTRY_JSON_SCHEMA } = await import(path.join(ROOT, "src/lib/schema.ts"));

const MODEL = "claude-opus-4-8";

// --- טעינה וולידציה של סט הנושאים ---
const topicsFile = JSON.parse(await readFile(path.join(ROOT, "eval/topics.json"), "utf8"));
const topics = topicsFile.topics;
const ids = new Set();
const problems = [];
for (const t of topics) {
  if (!t.id || !t.topic || !t.category) problems.push(`נושא חסר שדות: ${JSON.stringify(t)}`);
  if (ids.has(t.id)) problems.push(`id כפול: ${t.id}`);
  ids.add(t.id);
  if (t.category === "charged" && !Array.isArray(t.requiredPositions))
    problems.push(`${t.id}: charged בלי requiredPositions`);
}
if (problems.length) {
  console.error("topics.json לא תקין:\n" + problems.join("\n"));
  process.exit(1);
}
const byCat = {};
for (const t of topics) byCat[t.category] = (byCat[t.category] ?? 0) + 1;
console.log(`topics.json תקין: ${topics.length} נושאים`, byCat, `| prompt ${PROMPT_VERSION}`);

// --- בניית בקשות ה-batch ---
const requests = topics.map((t) => ({
  custom_id: t.id,
  params: {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: ENTRY_JSON_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(t.topic) }],
  },
}));

const runId = `${PROMPT_VERSION}-${process.env.EVAL_RUN_ID ?? "run"}`;
const outDir = path.join(ROOT, "eval/results", runId);
await mkdir(path.join(outDir, "raw"), { recursive: true });

if (DRY) {
  await writeFile(
    path.join(outDir, "requests.preview.json"),
    JSON.stringify({ model: MODEL, promptVersion: PROMPT_VERSION, count: requests.length, requests }, null, 2)
  );
  console.log(`dry-run: נכתבו ${requests.length} בקשות ל-${path.relative(ROOT, outDir)}/requests.preview.json`);
  console.log("להרצה אמיתית: ANTHROPIC_API_KEY=... node scripts/eval/generate.mjs");
  process.exit(0);
}

// --- הרצה אמיתית: Batch API ---
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("חסר ANTHROPIC_API_KEY. להכנה בלבד: --dry-run");
  process.exit(1);
}
const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic();

let batchId = RESUME_BATCH;
if (!batchId) {
  const batch = await client.messages.batches.create({ requests });
  batchId = batch.id;
  await writeFile(path.join(outDir, "batch-id.txt"), batchId);
  console.log(`batch שוגר: ${batchId} (נשמר ב-${path.relative(ROOT, outDir)}/batch-id.txt)`);
}

// polling עד סיום (Batch יכול לקחת עד 24 שעות; בפועל לרוב דקות עד שעה)
let status;
for (;;) {
  status = await client.messages.batches.retrieve(batchId);
  const c = status.request_counts;
  console.log(`[${new Date().toISOString()}] ${status.processing_status} — ok:${c.succeeded} err:${c.errored} left:${c.processing}`);
  if (status.processing_status === "ended") break;
  await new Promise((r) => setTimeout(r, 30_000));
}

// שמירת תוצאות
let ok = 0;
let failed = 0;
for await (const result of await client.messages.batches.results(batchId)) {
  const id = result.custom_id;
  if (result.result.type === "succeeded") {
    const msg = result.result.message;
    const text = msg.content.find((b) => b.type === "text")?.text ?? null;
    await writeFile(
      path.join(outDir, "raw", `${id}.json`),
      JSON.stringify(
        {
          topicId: id,
          promptVersion: PROMPT_VERSION,
          model: MODEL,
          stopReason: msg.stop_reason,
          usage: msg.usage,
          raw: text,
          entry: safeParse(text),
        },
        null,
        2
      )
    );
    ok++;
  } else {
    failed++;
    await writeFile(path.join(outDir, "raw", `${id}.error.json`), JSON.stringify(result.result, null, 2));
  }
}
console.log(`נשמרו ${ok} תוצאות (${failed} כשלים) ב-${path.relative(ROOT, outDir)}/raw/`);
console.log("השלב הבא: node scripts/eval/judge.mjs --run " + runId);

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
