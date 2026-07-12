# מצב הפרויקט — נקודת המשך (Handoff)

> עודכן: 2026-07-10. קרא אותי קודם אם אתה סשן חדש.

## מה זה
perspectipedia — אנציקלופדיה הוגנת מרובת-נקודות-מבט (עברית, RTL). משתמש מקליד נושא, Claude Opus 4.8
מייצר 2-5 עדשות מבוססות, כל אחת עם "על מה זה מבוסס", והכול נשמר. עיקרון-על: **מבחן הביסוס**.

## מסמכים (קרא לפי הסדר)
1. **`docs/ENGINEERING_PLAN.md`** — תוכנית הביצוע הפעילה (פאזות 0–5, הכרעות D1–D5). **עובדים לפיה.**
2. **`docs/ARCHITECTURE_TARGET.md`** — ארכיטקטורת היעד + מפת הבנייה (M1–M5).
3. `docs/PRODUCT_SPEC.md` — אפיון מוצר, 4 עקרונות-על.
4. `docs/ARCHITECTURE.md` — ארכיטקטורת v1 (היסטורי; מסמך היעד גובר).
5. `docs/ROADMAP.md` — roadmap אסטרטגי (תוכנן ע"י Fable 5).
6. `docs/BIAS_STRATEGY.md` — אסטרטגיית דה-ביאס (תוכנן ע"י Fable 5).

## מה בנוי ועובד (נבדק ויזואלית)
- לולאת הליבה: נושא → cache → generate (Opus 4.8, structured output) → אכיפת ביסוס → persist → render.
- מסכים: דף בית, דף ערך (SSR מה-DB; יצירה רק בכפתור מפורש), מצב השוואה, ספרייה, דף שקיפות (`/method`).
- בטיחות: מנגנון סירוב, טיפול מלא ב-stop reasons (refusal+max_tokens), מבחן ביסוס, מכסה יומית,
  אין drive-by generation (GET לעולם לא מייצר), needs_review/removed לא נחשפים בשום מסלול.
- דה-ביאס: עקרון-על 5 בחוקה, מבקר סימטריה מסומא (`src/lib/audit.ts`, flag-gated), מיון עדשות אלפביתי.
- provenance: status/promptVersion/model/usage/costUsd/rawOutput + לוג יצירה מובנה; PROMPT_VERSION="v2".

## איפה אנחנו בתוכנית
עובדים לפי `docs/ENGINEERING_PLAN.md` דרך מפת הבנייה ב-`docs/ARCHITECTURE_TARGET.md` (M1–M5).
**סטטוס: M1 ("נכון ובטוח") הושלם.** כל 8 הצעדים בוצעו ואומתו התנהגותית:
0.1 (דליפת needs_review) · 0.2+0.3 (SSR, בלי drive-by, בלי ?q=) · 0.4+0.5 (stop reasons,
rawOutput, costUsd, לוג) · 1.1 (rate limit פר-IP) · 1.3+1.4 (admin+דיווח) · 1.5א (נרמול+alias)
· 1.2 (שער-Haiku, כבוי) · 5.1 (job-row+polling, מנעול על מרוצים, אימוץ תקועים).
**M2 ("פרוס read-only") — פרוס ✅ (2026-07-10):** production חי ב-Vercel (פרויקט
perspectipedia של trtrhtv) מעל Neon Postgres (eu-central-1). מצב read-only — אין
`ANTHROPIC_API_KEY` בכוונה; יצירה מציגה "תיפתח בקרוב". מיגרציות + seed-אם-ריק רצים
אוטומטית בכל build (`scripts/deploy-setup.mjs` דרך `vercel.json`; מיגרציות על
`DIRECT_DATABASE_URL` הלא-pooled). דחיפה ל-main = פריסה אוטומטית. Next שודרג ל-15.5.20
(Vercel חוסם builds עם CVE-2025-66478). ה-`ADMIN_TOKEN` אצל המפעיל.
**M3 ("eval-ready + UI היעד") — הושלם:** מסמך פסיקה (`docs/GROUNDING_CASES.md`, ממתין
לאישור המייסד) + טיוטת חוקה v3 (`docs/PROMPT_V3_DRAFT.md`) + BYOK נסגר (D2) + תיקוני
audit (body במבט הגלוי, ניסוח כן ב-method) + באנר אמפירי + badges אפיסטמיים + crux +
badges ביסוס מקושר + `scripts/check-links.mjs` + תשתית eval מלאה (`eval/topics.json` —
36 נושאים, `eval/rubric.md`, `scripts/eval/generate.mjs` Batch+dry-run, `judge.mjs` עם
החלפת-תוויות, מעבר-שפה דטרמיניסטי, ושופט חוצה-משפחות). dry-run עובר.
**סבב הכרעות-המייסד (2026-07-10, אחרי הפריסה):** D1.1 עדשת הבנה-מבפנים + תווית
phenomenological · D1.2 קונספירציות מתועדות נכנסות (מבחן הראיות) · D1.3 "הצגה-עם-גורל"
מחליפה חסימה (טענות שהופרכו מוצגות כטיעון מחזיקיהן + גורלן) · D1.4 אידיאולוגיות קשות
(כהנאות, נאציזם) נכנסות בקול תיאור-נאמן; מדיניות תוכן צומצמה להסתה/נזק/אדם-חי ·
D1.5 חיים חסומים (כולל אישי ציבור), מתים נכנסים ("ישו" מקרה 12) · מקרה 13 פלורליזם
מדעי פנימי · D7 בחירת עומק לקורא · D8 רב-לשוניות (סכמה ב-v3, EN אחרי M5).
**המייסד אישר עקרונית את הכיוון בשיחה; אישור פורמלי סופי של GROUNDING_CASES — בקריאה הבאה.**

**שיפורי טרום-מפתח שבוצעו (PRE_KEY):** SEO (noindex לדפי-יצירה, sitemap, robots, OG,
"נחקרו לאחרונה") · הוגנות (ערבוב עדשות דטרמיניסטי פר-ערך במקום אלפביתי, הסבר אפיסטמי
נגיש במגע, חותמת שקיפות פר-ערך) · מוכנות-M4 (MOCK_LLM=1 — כל הצנרת נבדקה מקצה-לקצה
כולל כל 5 המסלולים; סבב-התיקון של המבקר ממומש) · בורר עומק "סיכום/מפורטת" במסך היצירה
(plumbing; אכיפה מ-v3) · דף /support מאחורי NEXT_PUBLIC_SHOW_SUPPORT.
**נשארו ב-PRE_KEY (אופציונלי, בלי מפתח):** 4.5 רינדור ערך עמוק (TOC) · 4.6 השוואה
פרקית · 2.4 דיווח מובנה · 2.5 לינטר-שפה · 3.3 חיווט canonicalTopic · 3.4 כפתור regenerate.

**נוסף (2026-07-12):** ביקורת-קוד (18 תיקונים) + פאנל ביקורת-הוגנות אדוורסרי
(`BIAS_ARCHITECTURE_REVIEW.md` — 8 הכרעות D9 ממתינות למייסד) + **תשתית פרופילי עדשה (D10)**:
מודל LensProfile, 4 פרופילי-פיילוט ב-`profiles/` (חרדי-ליטאי, מדעי, שמרן-לאומי, ליברלית),
`scripts/load-profiles.mjs` מגורסן עם איפוס-אישור-בשינוי. ההזרקה ליצירה — עם v3.5.

**הבא: M4 — חסום על מפתח.** ביום שיש `ANTHROPIC_API_KEY`: (1) אישור פורמלי של
GROUNDING_CASES; (2) `npm run eval:generate` (baseline על v2, 42 נושאים); (3)
`npm run eval:judge`; (4) נחיתת v3 לפי הצ'קליסט ב-PROMPT_V3_DRAFT (כולל 9 השינויים:
דו-מסלולי, crux, url, מדיניות, sections/עומק, phenomenological, קול-תיאור, מעמד-תיאוריות);
(5) הדלקת דגלים; (6) עדכון ה-eval expectations לפי הצ'קליסט.

## החסם היחיד
**`ANTHROPIC_API_KEY`** — בלעדיו אי אפשר לייצר ערכים אמיתיים או להריץ eval.
לפיתוח/דמו לא צריך: `node scripts/seed.mjs` (ערך-דוגמה) או `MOCK_LLM=1` (צנרת מלאה).

## הרצה מקומית
```bash
npm install
cp .env.example .env.local            # Postgres מקומי: ראו DATABASE_URL בדוגמה
sudo service postgresql start          # בסביבת CCR: Postgres 16 מותקן
npm run db:migrate && node scripts/seed.mjs
npm run dev                            # http://localhost:3000
# בדיקת צנרת מלאה בלי מפתח: MOCK_LLM=1 ENABLE_SYMMETRY_AUDIT=1 npm run dev
```

## פרודקשן
Vercel (פרויקט perspectipedia, חשבון trtrhtv) + Neon Postgres. דחיפה ל-main = פריסה
אוטומטית כולל מיגרציות (vercel.json → scripts/deploy-setup.mjs). read-only עד המפתח.
ADMIN_TOKEN אצל המפעיל; /admin הוא תור הסקירה וכלי ההסרה.

## קבצי מפתח
- `src/lib/prompts.ts` — החוקה (הנחיית המערכת). eval-gated לשינויים.
- `src/lib/schema.ts` — JSON Schema (מבחן הביסוס בקוד) + סכמת המבקר.
- `src/lib/claude.ts` — מנוע היצירה.
- `src/lib/audit.ts` — מבקר הסימטריה המסומא.
- `src/lib/entryService.ts` — לולאת הליבה + persist + cap.
