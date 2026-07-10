# perspectipedia — הקשר לסשן חדש

אתה עובד על **perspectipedia** — אנציקלופדיה הוגנת מרובת-נקודות-מבט (עברית, RTL).
משתמש מקליד נושא → Claude Opus 4.8 מייצר 2-5 עדשות מבוססות → כל אחת עם "על מה זה מבוסס" → נשמר במסד.
עיקרון-על: **מבחן הביסוס** (עדשה נכנסת רק אם מנומקת ומבוססת על מקורות אמיתיים).

## קרא קודם
1. **`docs/STATE.md`** — נקודת ההמשך: מה בנוי, מה נבדק, מה הצעד הבא. **התחל כאן.**
2. `docs/PRODUCT_SPEC.md` — אפיון מוצר, 4 עקרונות-על.
3. `docs/ARCHITECTURE.md` — ארכיטקטורה.
4. `docs/ROADMAP.md` — הדרך להשקה (תוכנן ע"י Fable 5).
5. `docs/BIAS_STRATEGY.md` — אסטרטגיית דה-ביאס (Fable 5).
6. `docs/COST_AND_KEY.md` — כלכלה, עלויות, הוזלה.

## הרצה מקומית (הסביבה טרייה — צריך להתקין)
```bash
npm install
cp .env.example .env.local   # הוסף ANTHROPIC_API_KEY אם רוצים יצירה אמיתית
npm run db:push
node scripts/seed.mjs        # ערך-דוגמה לבדיקת התצוגה (בלי מפתח)
npm run dev                  # http://localhost:3000
```

## מצב נוכחי
v1 בנוי, מוקשח, בטוח, עם ספרייה, דה-ביאס ושקיפות. נבדק ויזואלית (חוץ מפלט המודל עצמו).
**החסם היחיד:** `ANTHROPIC_API_KEY` — נחוץ ליצירה אמיתית, eval, הפעלת המבקר, ופריסה. לפיתוח לא צריך (seed).
**הצעד הבא:** הכנת פריסה (Postgres/Neon + Vercel + DEPLOY.md), ואז eval כשיש מפתח.

## מוסכמות
- שינוי ב-`src/lib/prompts.ts` (החוקה) הוא eval-gated — לא לשנות בלי הרצת eval (ראו ROADMAP §1).
- לפרוס/לדחוף רק ל-`trtrhtv/perspectipedia`, ענף `main`.
