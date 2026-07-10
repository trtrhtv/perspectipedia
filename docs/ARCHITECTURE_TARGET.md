# ארכיטקטורת היעד — perspectipedia במצבה הסופי

> נכתב ע"י Claude Fable 5 · 2026-07-10 · משלים את `ENGINEERING_PLAN.md`.
> **חלוקת העבודה בין המסמכים:** ה-PLAN אומר *מתי ובאיזה סדר* (משימות 0.1–5.2, פאזות,
> acceptance); המסמך הזה אומר *איך המערכת בנויה במצבה הסופי* — ואיך כל צעד בנייה מתכנס
> לשם. הפניות בסגנון "(PLAN 1.3)" מצביעות למשימה המתאימה שם. הכרעות D1–D5 בתוקף.
> `docs/ARCHITECTURE.md` הישן מתאר את v1 כפי שנבנה; במקרה של פער — המסמך הזה גובר.

---

# חלק 1 — ארכיטקטורת היעד (המצב הסופי)

## 1. עקרונות ארכיטקטוניים

1. **ה-DB הוא מקור האמת, לא ה-LLM.** הרינדור קורא תמיד משורות Prisma. כל שדרוג עתידי
   (עריכה אנושית, RAG, רב-מודליות) הוא שינוי ב*אופן מילוי* השורות — לא בקוראים שלהן.
2. **הפרדת read-path מ-write-path.** GET לעולם לא מייצר ולא עולה כסף. יצירה קורית רק
   ב-POST מפורש, מאחורי כל שכבות ההגנה. זה גם אבטחה, גם עלות, גם SEO.
3. **הצנרת אגנוסטית-למפתח-ולמודל.** אף מודול מעל `claude.ts`/`gate.ts`/`audit.ts` לא
   מכיר טיפוסי Anthropic. כל נקודת-LLM היא פונקציה עם קלט/פלט מוגדרים — כך מחליפים מודל,
   ספק, או מקור-מימון (שכבת תורמים) בלי לגעת בשאר המערכת.
4. **כל התנהגות תלוית-מודל מאחורי דגל `ENABLE_*`.** ברירת המחדל כבויה; הפעלה בפרודקשן
   רק אחרי eval (עקביות עם CLAUDE.md: `prompts.ts` הוא eval-gated).
5. **שורת ה-Entry היא גם ה-job.** `status="pending"` + ייחודיות `slug` = תור, מנעול
   ו-dedup בלי תשתית queue חיצונית (ROADMAP §3, PLAN 5.1). מוסיפים worker חיצוני רק אם
   הנפח יכריח — וה-seam כבר קיים.
6. **seams במקום ספקולציה.** לא בונים פיצ'רים עתידיים; בונים כך שהוספתם היא מיגרציה
   קטנה ומודול אחד (ראו §7). עמודות "ליתר ביטחון" — לא מוסיפים.

## 2. דיאגרמת מודולים

```
┌────────────────────────────── Frontend (React, RTL) ──────────────────────────────┐
│ pages: / · /library · /method · /entry/[slug] (SSR מה-DB) · /admin (token)        │
│ components: SearchBox · EntryDisplay · CreateEntryFlow (polling) · LensSwitcher   │
│            LensView (+badges ביסוס, +דיווח) · CompareView (+crux) · EmpiricalBanner│
└──────────────┬──────────────────────────────────────────────────┬─────────────────┘
               │ HTTP (ציבורי)                                    │ HTTP + ADMIN_TOKEN
┌──────────────▼────────────── API Layer (route handlers) ────────▼─────────────────┐
│ POST /api/entry        · GET /api/entry/[slug]       · POST /api/report           │
│ GET|PATCH|DELETE /api/admin/entries                                               │
└──────────────┬────────────────────────────────────────────────────────────────────┘
┌──────────────▼────────────── Service Layer (src/lib) ─────────────────────────────┐
│ entryService.ts — לולאת הליבה: cache → הגנות → job-row → persist → מצבים          │
│    ├── normalize.ts   נרמול דטרמיניסטי + TopicAlias (סמנטי דרך gate) (PLAN 1.5)   │
│    ├── ratelimit.ts   ממשק אחד, שני מימושים: memory | Upstash        (PLAN 1.1)   │
│    ├── gate.ts        Haiku: allow/refuse/needs_care + כותרת קנונית  (PLAN 1.2)   │
│    │                  [ENABLE_TOPIC_GATE, ENABLE_SEMANTIC_NORMALIZE]              │
│    ├── claude.ts      Opus: יצירה, מבחן ביסוס דו-מסלולי (D1), retry  (PLAN 3.6)   │
│    │     ├── prompts.ts  החוקה (PROMPT_VERSION) — eval-gated                      │
│    │     ├── schema.ts   ENTRY/AUDIT/GATE JSON Schemas                            │
│    │     └── audit.ts    מבקר מסומא + סבב תיקון אחד [ENABLE_SYMMETRY_AUDIT] (3.7) │
│    ├── adminAuth.ts   אימות token — מודול יחיד, מוחלף בעתיד ב-auth אמיתי          │
│    └── db.ts · slug.ts · types.ts                                                 │
└───────┬──────────────────────┬───────────────────────────┬────────────────────────┘
┌───────▼────────┐  ┌──────────▼─────────────┐  ┌──────────▼────────────────────────┐
│ Prisma → Neon  │  │ Anthropic API          │  │ scripts/ (CLI, מחוץ לשרת)         │
│ Postgres:      │  │  Opus 4.8 (יצירה+מבקר) │  │  seed.mjs · eval/generate.mjs     │
│ Entry · Lens · │  │  Haiku 4.5 (שער)       │  │  eval/judge.mjs (+שופט חוצה-      │
│ TopicAlias ·   │  │  Batch API (eval,      │  │  משפחות, אופליין בלבד — D3)       │
│ Report         │  │  קורפוס השקה)          │  │  check-links.mjs (PLAN 4.2)       │
└────────────────┘  └────────────────────────┘  └───────────────────────────────────┘
```

גבולות חשובים: ה-Frontend לא יודע על LLM בכלל (מקבל Entry מוכן או סטטוס). שכבת ה-API
דקה — ולידציה, אימות, קודי מצב. כל ההיגיון בשכבת השירות. סקריפטים (eval, check-links)
חיים מחוץ לשרת ורצים ידנית/CI — לא חלק מבקשת משתמש לעולם.

## 3. מודל הנתונים הסופי (Prisma, יעד M5)

```prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }   // PLAN 2.1

model Entry {
  id             String   @id @default(cuid())
  slug           String   @unique            // המפתח והמנעול (unique = mutex)
  topic          String                      // הנושא כפי שאושר למשתמש
  canonicalTopic String?                     // כותרת קנונית מהנרמול הסמנטי (1.5ב)
  topicKind      String                      // meaning | mixed | empirical
  status         String   @default("pending")
  // pending | published | needs_review | refused | failed | removed  (ראו §4)
  refusalReason  String?                     // אם refused — הסיבה (שער או מודל)
  crux           String?                     // "מוקד המחלוקת" — נכתב מ-v3 (PLAN 4.3)
  rawOutput      String?                     // פלט Opus גולמי (PLAN 0.4)
  lastError      String?                     // אם failed — השגיאה האחרונה

  // provenance + עלות (PLAN 0.4)
  promptVersion  String   @default("v1")
  model          String   @default("claude-opus-4-8")
  inputTokens    Int?
  outputTokens   Int?
  costUsd        Float?
  auditVerdict   String?                     // pass | revise | fail (אחרי סבב תיקון)
  auditJson      Json?                       // AuditResult מלא — לדשבורד הטיה עתידי

  // job-row (PLAN 5.1)
  generationStartedAt DateTime?              // לשחרור pending תקוע (timeout)
  attemptCount   Int      @default(0)

  lenses    Lens[]
  aliases   TopicAlias[]
  reports   Report[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, createdAt])               // ספרייה, תור admin, מכסה יומית
}

model Lens {
  id            String  @id @default(cuid())
  entryId       String
  entry         Entry   @relation(fields: [entryId], references: [id], onDelete: Cascade)
  name          String
  family        String        // religious|scientific|philosophical|political|cultural|historical
  summary       String
  body          String
  grounding     Json          // [{ source, explanation, url? }] — url מ-v3 (PLAN 4.2)
  epistemicType String        // הציר של המסלול (D1): meaning-narrative|value-position|
                              // empirical-grounded|methodological-critique
  confidence    String?
  order         Int
  editedByHuman Boolean @default(false)      // הצעד ההיברידי (v2)
  @@index([entryId])
}

model TopicAlias {                            // PLAN 1.5
  id        String   @id @default(cuid())
  alias     String   @unique                 // slug מנורמל של ניסוח חלופי
  entryId   String
  entry     Entry    @relation(fields: [entryId], references: [id], onDelete: Cascade)
  source    String                            // deterministic | semantic | admin
  createdAt DateTime @default(now())
}

model Report {                                // PLAN 1.4
  id        String   @id @default(cuid())
  entryId   String
  entry     Entry    @relation(fields: [entryId], references: [id], onDelete: Cascade)
  lensName  String?                           // אופציונלי: על איזו עדשה
  reason    String
  status    String   @default("open")         // open | resolved
  createdAt DateTime @default(now())
  @@index([status, createdAt])
}
```

**מיגרציית ה-Postgres (PLAN 2.1) היא מיגרציה מרכזת אחת:** provider, `grounding → Json`
(מבטל `JSON.parse/stringify` ב-`entryService.ts`), וכל העמודות/הטבלאות החדשות שנצברו
בפאזות 0–1 (rawOutput, costUsd, audit*, job fields, crux, TopicAlias, Report). לכן סדר
הבנייה (חלק 2) מסיים את כל נגיעות-הסכמה על SQLite (`db:push`) *לפני* המיגרציה.

**מה בכוונה לא בסכמה** (נוסף במיגרציה עתידית קטנה, ראו §7): `LensRevision` (v2),
`locale` (רב-שפתיות), `fundedBy` (שכבת תורמים), טבלאות משתמשים.

## 4. מחזור החיים של ערך (state machine)

```
                          POST /api/entry (עבר את כל ההגנות §5)
                                         │  יוצר שורה — זה המנעול
                                         ▼
   שער/מודל סירבו ──────────────►  ┌─────────┐
   ┌─────────┐                     │ pending │◄─────────────── retry (failed→pending,
   │ refused │◄────────────────────┤         │                  attemptCount++)
   └─────────┘   (טרמינלי; משמש    └────┬────┘
        ▲         blocklist זול)        │ generate → מבחן ביסוס דו-מסלולי → audit
        │                               │
        │            ┌──────────────────┼──────────────────────┐
        │            ▼                  ▼                       ▼
        │      audit pass         audit revise→תיקון→     שגיאה אחרי
        │      (או מכובה)         re-audit                MAX_ATTEMPTS
        │            │            │pass      │עדיין major       │
        │            ▼            ▼          ▼                  ▼
        │      ┌───────────┐◄─────┘   ┌──────────────┐    ┌────────┐
        │      │ published │          │ needs_review │    │ failed │
        │      └─────┬─────┘          └──────┬───────┘    └────────┘
        │            │    admin unpublish    │ admin publish
        │            │◄──────────────────────┤
        │            │ admin remove          │ admin remove
        │            ▼                       ▼
        │      ┌─────────────────────────────────┐
        └──────│            removed              │  (טרמינלי; ה-slug נשאר תפוס)
               └─────────────────────────────────┘
```

**מי מעביר בין מצבים:**

| מעבר | מי | מתי |
|---|---|---|
| ∅ → `pending` | `POST /api/entry` (route + entryService) | אחרי normalize/alias/cache/ratelimit/cap/gate; ה-insert עצמו הוא קניית המנעול |
| `pending` → `refused` | gate (לפני Opus) או המודל (`refused=true` / `stop_reason: refusal`) | בזמן הבקשה |
| `pending` → `published` | entryService, אחרי audit pass (או כשהמבקר כבוי) | סוף היצירה |
| `pending` → `needs_review` | entryService, אחרי audit שנשאר major גם אחרי סבב תיקון (PLAN 3.7) | סוף היצירה |
| `pending` → `failed` | entryService, שגיאה אחרי `MAX_ATTEMPTS` (נשמר `lastError`) | סוף היצירה |
| `pending` תקוע → שחרור | POST חוזר: אם `generationStartedAt` ישן מ-timeout (קבוע, ~6 דק') — מאמצים את השורה ומנסים שוב | polling/בקשה חוזרת |
| `failed` → `pending` | כפתור "נסו שוב" (משתמש, rate-limited) או admin | לפי דרישה |
| `needs_review` → `published` / `removed` | admin בלבד (PLAN 1.3) | סקירה אנושית |
| `published` → `needs_review` / `removed` | admin בלבד | דיווח/תקלה |

**חשיפה ציבורית לפי מצב:** רק `published` מופיע בספרייה ומוגש ב-URL. `pending` מציג
מסך "בונים את הערך" (polling). `needs_review` מציג "בבדיקת הוגנות" — לא את התוכן
(PLAN 0.1). `refused` מציג את מסך הסירוב. `failed` מציג שגיאה + retry. `removed` = 404.

**Regeneration (מדיניות promptVersion):** פעולת admin או סקריפט batch: יוצרת מחדש את
העדשות על אותה שורת Entry בטרנזקציה (מחיקת lenses ישנות ↔ החדשות), מעדכנת
`promptVersion`/`rawOutput`/usage, ועוברת את audit כרגיל. עד שקיים `LensRevision` (v2)
אין היסטוריה — לכן regeneration המוני מריצים רק אחרי גיבוי dump. ערך עם
`editedByHuman=true` באחת מעדשותיו — לא עובר regeneration אוטומטי.

## 5. צנרת היצירה הסופית

```
POST /api/entry {topic}
 1. validate            route.ts            ריק/אורך>120 → 400
 2. normalize (דטרמ')   normalize.ts        ניקוד, גרשיים, סופיות, רווחים → slug
 3. alias lookup        normalize.ts        TopicAlias.alias=slug → הפניה לערך קיים
 4. cache check         entryService.ts     Entry קיים → 200 לפי מצבו (§4)
 5. rate limit פר-IP    ratelimit.ts        חריגה → 429                      [Upstash בפרוד]
 6. מכסה יומית          entryService.ts     count(createdAt≥היום) ≥ GEN_DAILY_CAP → 429
 7. שער-נושא (Haiku)    gate.ts             refuse → שורת refused (blocklist)  [ENABLE_TOPIC_GATE]
    + כותרת קנונית                          canonicalTopic; ניטרול ניסוח מוטה [ENABLE_SEMANTIC_NORMALIZE]
 8. job-row             entryService.ts     insert pending (unique slug=mutex) → 202 {slug}
 ─── מכאן העבודה ה"כבדה" — עדיין בתוך אותה בקשה (worker=הבקשה שקנתה את המנעול) ───
 9. generate            claude.ts           Opus, חוקה v3, structured output, retry×2
10. מבחן ביסוס דו-מסלולי claude.ts          D1: passesGroundingBar + סינון לפי epistemic_type
11. audit + סבב תיקון   audit.ts            מסומא; revise→תיקון→re-audit      [ENABLE_SYMMETRY_AUDIT]
12. persist             entryService.ts     lenses+crux+rawOutput+usage+auditJson → status
 ─── בצד הלקוח ───
13. polling             CreateEntryFlow     GET /api/entry/[slug] כל ~2.5s עד ready/refused/failed
```

מדרג העלות מובנה בסדר: שלבים 1–6 חינם, שלב 7 ~$0.001 (Haiku), ורק מי שעבר הכול מגיע
לשלב 9 (~$0.15–0.5, Opus) ולשלב 11 (~$0.05–0.1). **מיקום הדגלים:** כל דגל נבדק בתוך
המודול שלו (`gate.ts`, `audit.ts`) — לא בקוד הקורא; כיבוי דגל = הצנרת מתקצרת בשקיפות.

## 6. פני ה-API (route map סופי)

| Route | Method | אימות | צרכן | התנהגות |
|---|---|---|---|---|
| `/`, `/library`, `/method` | GET | — | דפדפן | SSR; ספרייה מציגה רק `published` |
| `/entry/[slug]` | GET | — | דפדפן, קרולרים | SSR מה-DB לפי מצב (§4). **לעולם לא מייצר** (PLAN 0.2) |
| `/api/entry` | POST | rate limit פר-IP | `SearchBox`/`CreateEntryFlow` | הצנרת §5. מחזיר: 200 (קיים) / 202 (pending נוצר) / 400 / 429 / refused |
| `/api/entry/[slug]` | GET | — | polling של `CreateEntryFlow` | `{status, entry?, reason?}`; קריאה בלבד |
| `/api/report` | POST | rate limit | `LensView` | יצירת Report (PLAN 1.4) |
| `/admin` | GET | `ADMIN_TOKEN` (cookie/header) | מפעיל | ממשק ניהול (PLAN 1.3) |
| `/api/admin/entries` | GET / PATCH / DELETE | `ADMIN_TOKEN` | admin UI | list (כולל needs_review/refused/failed + דיווחים) / שינוי מצב + regenerate / מחיקה |
| `scripts/seed.mjs` | CLI | — | פיתוח | ערך-דוגמה בלי מפתח |
| `scripts/eval/generate.mjs`, `judge.mjs` | CLI | מפתחות env | מפעיל/CI | חבילת ה-eval (PLAN 3.3) — לעולם לא מהשרת |
| `scripts/check-links.mjs` | CLI | — | מפעיל/CI | אימות URL של grounding (PLAN 4.2) |

הערה: אין endpoint‏ של `?q=` או כל ערוץ אחר שבו הלקוח קובע טקסט תצוגה (PLAN 0.3) —
הנושא המוצג מגיע תמיד מ-`Entry.topic` שב-DB.

## 7. נקודות הרחבה מוכנות-מראש (seams)

לכל הרחבה: איפה ה-seam, ומה נבנה *כבר עכשיו* אחרת כדי שהיא תיכנס בלי שבירה.

| הרחבה עתידית | ה-seam בקוד | מה בונים עכשיו אחרת |
|---|---|---|
| **מבקר חוצה-משפחות** (D3, v2) | `audit.ts` הוא נקודת הכניסה היחידה: `runAudit(entry) → AuditResult`. אף טיפוס Anthropic לא דולף החוצה. | חוזה ה-`AuditResult` (schema.ts) נשאר ספק-אגנוסטי; שם המודל עובר ל-env (`AUDIT_MODEL`) ולא קבוע בקוד; השופט הזר נכנס קודם ל-eval האופליין (`eval/judge.mjs`) — אותו חוזה JSON. החלפה = מימוש client שני בתוך `audit.ts`. |
| **שכבת תורמים (BYOK-לתרומה)** (D2) | `claude.ts::getClient()` — נקודת יצירת ה-client היחידה. | `generateEntry` מקבל אובייקט options (גם אם ריק היום); בעתיד: `{apiKeyOverride, fundedBy}` + עמודת `fundedBy` במיגרציה קטנה. **כל שאר הצנרת (שער, מבחן ביסוס, audit) זהה** — תרומה עוברת את אותם מסננים, וזה כל הרעיון. |
| **ביסוס-מקושר מלא / RAG** | (א) צורת פריט grounding `{source, explanation, url?}` — כבר בסכמת v3; (ב) `buildUserPrompt(topic)` ב-`prompts.ts`. | חתימת `buildUserPrompt` תורחב ל-`(topic, context?)` — מודול אחזור עתידי (`src/lib/retrieve/` — sefaria.ts, wikisource.ts) יזריק מקורות-מועמדים לפרומפט לפני היצירה. ה-UI (badges "מקור מקושר") כבר בנוי ב-PLAN 4.2 ולא ישתנה. |
| **רב-שפתיות** | `prompts.ts` (חוקה פר-שפה) + מפתוח ה-slug. | **עודכן (D8, PLAN 4.9):** סכמת ה-locale (עמודת `locale @default("he")` + מעבר ל-`@@unique([locale, slug])` + חוקה כמפה פר-locale) נכנסת כבר במיגרציית v3 — זול עכשיו, יקר אחר-כך. הפעלת EN (חוקה-EN, ניתוב `/en/`, eval-EN, קורפוס native) — רק אחרי M5, כשהעברית מוכחת. |
| **חשבונות וקהילה** (v3 מוצרי) | `adminAuth.ts` — כל האימות במודול אחד; `Report` ו-(בעתיד) `LensRevision` הם זרעי מודל התוכן הקהילתי. | admin נבנה כ-API + UI נפרדים (לא לוגיקה בדפים) כך שהחלפת token ב-auth אמיתי נוגעת במודול אחד; `editedByHuman` כבר קיים על Lens. |
| **עריכה אנושית + היסטוריה** (v2) | פעולת ה-regenerate/edit ב-admin API. | טבלת `LensRevision` (snapshots append-only) נוספת כמיגרציה עצמאית; כל כתיבת-lenses כבר עוברת דרך נקודה אחת (`entryService.persist`) שאליה מחברים את ה-snapshot. |
| **Tiering מודלים** (eval-gated) | קבוע `MODEL` ב-`claude.ts` הופך ל-`chooseModel(topic, gateResult)`. | ה-gate כבר מחזיר `needs_care` — זה בדיוק אות הניתוב (נושא רגיש → Opus; שגרתי → Sonnet). לא מפעילים בלי eval. |
| **worker/queue חיצוני** | ההפרדה בין "קניית המנעול" (שלב 8) ל"עבודה" (שלבים 9–12) ב-`entryService`. | העבודה ממומשת כפונקציה עצמאית `processPendingEntry(slug)` — היום נקראת מאותה בקשה; מחר נקראת מ-cron/queue בלי שינוי בלוגיקה. |

## 8. חתך תפעולי

### משתני סביבה (מלא)

| משתנה | חובה | ברירת מחדל | תפקיד |
|---|---|---|---|
| `DATABASE_URL` | ✔ | — | Neon Postgres (dev: SQLite עד PLAN 2.1) |
| `ANTHROPIC_API_KEY` | ✖ | — | בלעדיו: מצב read-only (ספרייה בלבד, PLAN 2.3) |
| `ADMIN_TOKEN` | ✔ בפרוד | — | אימות `/admin` ו-`/api/admin/*` |
| `GEN_DAILY_CAP` | ✖ | `100` | תקרת יצירות יומית גלובלית (hard-stop) |
| `RATE_LIMIT_CREATES_PER_HOUR` | ✖ | `3` | תקרת יצירות פר-IP |
| `UPSTASH_REDIS_REST_URL/TOKEN` | ✖ | — | ratelimit בפרוד; בלעדיהם: מימוש in-memory |
| `ENABLE_TOPIC_GATE` | ✖ | `0` | שער-Haiku (PLAN 1.2) — מדליקים עם מפתח |
| `ENABLE_SEMANTIC_NORMALIZE` | ✖ | `0` | קנוניזציה סמנטית (PLAN 1.5ב) |
| `ENABLE_SYMMETRY_AUDIT` | ✖ | `0` | המבקר המסומא (מדליקים אחרי eval, PLAN 3.7) |
| `AUDIT_MODEL` | ✖ | `claude-opus-4-8` | seam למבקר חוצה-משפחות (v2) |

### Observability
- **שורת לוג מובנית לכל יצירה** (PLAN 0.4): `{slug, model, promptVersion, inputTokens,
  outputTokens, costUsd, durationMs, gateResult, auditVerdict, finalStatus, attempt}`.
- **עלות נשמרת ב-DB** (`costUsd`) — דף ה-admin מציג סיכום יומי/מצטבר ואת ניצול המכסה.
- **rawOutput + auditJson** על כל שורה — post-mortem לכל ערך בעייתי בלי לשחזר יצירה.
- אות אזעקה תפעולי פשוט: המכסה היומית נפגעה = מייל/בדיקה ידנית (בלי תשתית alerting ב-v1).

### גבולות עלות (חישוב תקרה)
תקרה יומית ≈ `GEN_DAILY_CAP × (Opus + audit)` ≈ `100 × ($0.5 + $0.1)` = **~$60/יום במקרה
הקיצון**, ובפועל הרבה פחות (cache, שער, rate limit). שער-Haiku מוסיף ≤$0.10/יום. ה-eval
והקורפוס רצים ב-Batch (50% הנחה) כהוצאה חד-פעמית מבוקרת.

---

# חלק 2 — מפת הבנייה: מה ואיך, שלב-אחר-שלב

כל צעד מפנה למשימות ה-ENGINEERING_PLAN (שם ה-acceptance המלא) ואומר איזה חלק
מהארכיטקטורה "נדלק" ואיזה שלד נשאר מוכן להרחבה. הסדר ליניארי; מה שמסומן ∥ אפשר במקביל.

### M1 — "נכון ובטוח" (מקומי; בלי מפתח)

| # | צעד (משימות PLAN) | מה נדלק בדיאגרמה | הנמקת התלות + השלד שנשאר |
|---|---|---|---|
| 1 | **אוצר-המצבים** (0.1) | מכונת המצבים §4 — הטיפול ב-`needs_review` | ראשון כי כל שאר הצעדים מדברים בשפת המצבים הזו. שלד: `EntryResult` המורחב הוא החוזה שה-admin, ה-polling וה-audit ישתמשו בו. |
| 2 | **הפרדת read/write** (0.2 + 0.3) | ה-route map §6: SSR ל-GET, יצירה רק ב-POST מפורש; פיצול `EntryDisplay`/`CreateEntryFlow` | לפני כל דבר ציבורי — סוגר את פרצות drive-by ו-`?q=`. שלד: `CreateEntryFlow` המבודד הוא בדיוק המקום שבו ה-polling של צעד 8 יתחבר. |
| 3 | **רצפת observability** (0.4 + 0.5) | `rawOutput`, לוג usage/עלות, טיפול מלא ב-stop reasons | לפני ה-eval וה-admin — שניהם צורכים את הנתונים האלה. |
| 4 | **ratelimit.ts** (1.1) | שלב 5 בצנרת §5 | שלד: ממשק אחד + מימוש memory; מימוש Upstash נכנס באותו ממשק ב-M2. |
| 5 | **admin + דיווח** (1.3 + 1.4) | עמודת ה-admin ב-§2, טבלת `Report`, מעברי-admin ב-§4 | **חייב לפני הפעלת audit בפרודקשן** — `needs_review` בלי תור סקירה הוא מבוי סתום; וחייב לפני כל פריסה — כלי ההסרה המהירה. שלד: `adminAuth.ts` הוא ה-seam לחשבונות. |
| 6 | **normalize + alias** (1.5א) | שלבים 2–3 בצנרת, טבלת `TopicAlias` | לפני המיגרציה (הטבלה נכנסת אליה). שלד: הפונקציה שה-gate יזין בכותרת קנונית (1.5ב). |
| 7 | **gate.ts כבוי** (1.2) | שלב 7 בצנרת (מאחורי דגל) | הקוד נכתב עכשיו כדי שהפעלת-מפתח ב-M4 תהיה הדלקת דגל, לא פיתוח. שלד: `needs_care` הוא ה-seam ל-tiering. |
| 8 | **job-row + polling** (5.1) | שלבים 8+13 בצנרת, מצבי `pending`/`failed`, `GET /api/entry/[slug]` | נבנה כאן (לא בסוף) כי הוא משנה סכמה — חייב להקדים את המיגרציה המרכזת — וכי הוא מחסל את כפל-קריאות-Opus עוד לפני שיש מפתח לשרוף. שלד: `processPendingEntry(slug)` — ה-seam ל-worker חיצוני. |

**M1 גמור כאשר:** כל צנרת §5 קיימת בקוד (דגלי ה-LLM כבויים), מכונת המצבים §4 מלאה,
וה-route map §6 ממומש — הכול על SQLite מקומי עם seed.

### M2 — "פרוס read-only" (בלי מפתח)

| # | צעד | מה נדלק |
|---|---|---|
| 9 | **המיגרציה המרכזת** (2.1) | מודל הנתונים הסופי §3 על Neon; `grounding Json`; Upstash ratelimit |
| 10 | **DEPLOY.md + פריסה** (2.2 + 2.3) | URL ציבורי מגיש ספרייה; יצירה חסומה בחן ("בקרוב") |

**M2 גמור כאשר:** production מגיש את הספרייה מ-Neon, admin עובד בפרוד, אפס עלות Anthropic.

### M3 — "eval-ready + UI היעד" (בלי מפתח; ∥ מקבילי ברובו)

| # | צעד | מה נדלק |
|---|---|---|
| 11 | **מסמך פסיקה + טיוטת v3** (3.1 + 3.2) | הספסיפיקציה של המסלול הדו-מסלולי (D1) — עדיין לא ב-`prompts.ts` |
| 12 ∥ | **תשתית eval** (3.3) | `scripts/eval/*` מוכן-להרצה, כולל שופט חוצה-משפחות אופליין (D3) |
| 13 ∥ | **תיקוני audit** (3.4) | body במבט הגלוי; ניסוח כן ב-`/method` |
| 14 ∥ | **UI היעד** (4.1 + 4.3-UI + 4.2-תשתית) | `EmpiricalBanner`, crux ב-`CompareView` (ריק עד v3), badges ביסוס + `check-links.mjs` |
| 15 ∥ | **סגירת BYOK** (4.4) | Decision log D2 ב-`COST_AND_KEY.md` |

**M3 גמור כאשר:** ביום קבלת מפתח — אין שום כתיבת-קוד שחוצצת בין המפתח לבין baseline eval.

### M4 — "v3 חי" (חסום על מפתח — נפתח ברגע שיש)

| # | צעד | מה נדלק |
|---|---|---|
| 16 | **baseline eval על v2** (3.5) | המדידה הראשונה אי-פעם; מדד-העל: דיוק ביסוס |
| 17 | **נחיתת v3** (3.6) | החוקה הדו-מסלולית + crux + url ב-`prompts.ts`/`schema.ts`; `PROMPT_VERSION="v3"` |
| 18 | **הדלקת השכבות** (3.7 + הפעלת 1.2, 1.5ב) | `ENABLE_SYMMETRY_AUDIT=1`, `ENABLE_TOPIC_GATE=1`, `ENABLE_SEMANTIC_NORMALIZE=1` — סבב התיקון חי, השער חי |

**M4 גמור כאשר:** יצירה חיה עומדת ברפי ה-eval, כל דגלי הצנרת דולקים, needs_review זורם לתור ה-admin.

### M5 — "השקה אצורה" (מפתח)

| # | צעד | מה נדלק |
|---|---|---|
| 19 | **קורפוס ההשקה** (5.2) | 30–50 ערכי v3 דרך Batch: audit-passed, אינסיידרים לטעונים, check-links, aliases |
| 20 | **השקה** | הספרייה האצורה ציבורית; יצירה פתוחה נפתחת בהדרגה מאחורי השער והמכסות |

### מה במפורש *לא* בונים עכשיו — למרות שהארכיטקטורה מוכנה לו

`LensRevision` והיסטוריית עריכות · מבקר חוצה-משפחות ב*פרודקשן* (רק ב-eval — D3) ·
שכבת התורמים (D2 — רק ה-seam) · מודול retrieve/RAG (רק צורת ה-url ו-seam הפרומפט) ·
רב-שפתיות · חשבונות/קהילה · SSE/streaming טוקנים · queue/worker חיצוני · tiering מודלים ·
דשבורד הטיה (רק אגירת `auditJson`). כל אחד מאלה נכנס דרך seam מוגדר ב-§7 — לא דרך שכתוב.

### עקביות עם ENGINEERING_PLAN
נבדקה סתירה אחת פוטנציאלית: מיקום job-row (PLAN 5.1, פאזה 5) מול הצורך להקדים אותו
למיגרציה המרכזת. אין סתירה בפועל — PLAN §10 כבר מסווג את 5.1 כ"עובדים עכשיו, בלי מפתח";
המסמך הזה רק קובע את מקומו המדויק ברצף (צעד 8, לפני 2.1). כל שאר המיפוי הוא אחד-לאחד.
