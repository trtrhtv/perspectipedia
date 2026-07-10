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
**M2 ("פרוס read-only") — הקוד מוכן:** מיגרציית Postgres מרכזת (PLAN 2.1, אומתה מול
Postgres 16 חי כולל חזרה גנרלית על DB טרי) + `DEPLOY.md` מלא + מצב read-only מוצרי
("יצירה תיפתח בקרוב"). **מה שנשאר ב-M2 דורש את המפעיל:** חשבונות Neon/Vercel, מיזוג
ל-main, ופריסה לפי `DEPLOY.md`.
**הבא בקוד: M3** — הכנות eval + UI היעד (PLAN 3.1–3.4, 4.1–4.4) — הכול בלי מפתח.

## החסם היחיד
**`ANTHROPIC_API_KEY`** — בלעדיו אי אפשר לייצר ערכים אמיתיים, להריץ eval, להפעיל את המבקר, או לפרוס.
לפיתוח/עיצוב/דמו **לא צריך מפתח** — משתמשים בערך-דוגמה: `node scripts/seed.mjs`.

## הרצה מקומית
```bash
npm install
cp .env.example .env.local   # הוסף ANTHROPIC_API_KEY אם רוצים יצירה אמיתית
npm run db:push
node scripts/seed.mjs        # ערך-דוגמה לבדיקת התצוגה (בלי מפתח)
npm run dev                  # http://localhost:3000
```

## הצעד הבא (לא הושלם)
- **הכנת פריסה:** מסלול Postgres (Neon) + `DEPLOY.md` (Vercel + env). ראו ROADMAP §2.
- כשיש מפתח: baseline eval (ROADMAP §1) → הפעלת המבקר → פריסה.

## קבצי מפתח
- `src/lib/prompts.ts` — החוקה (הנחיית המערכת). eval-gated לשינויים.
- `src/lib/schema.ts` — JSON Schema (מבחן הביסוס בקוד) + סכמת המבקר.
- `src/lib/claude.ts` — מנוע היצירה.
- `src/lib/audit.ts` — מבקר הסימטריה המסומא.
- `src/lib/entryService.ts` — לולאת הליבה + persist + cap.
