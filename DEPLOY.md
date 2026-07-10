# פריסת perspectipedia — Neon + Vercel (PLAN 2.2–2.3)

מדריך מלא מאפס ל-URL ציבורי. **הפריסה הראשונה היא read-only** — בלי `ANTHROPIC_API_KEY`,
האתר מגיש את הספרייה ויצירה סגורה בחן ("תיפתח בקרוב"). עלות Anthropic: אפס.

---

## שלב 0 — דרישות מוקדמות

| מה | איפה | עלות |
|---|---|---|
| חשבון Neon (Postgres מנוהל) | https://neon.tech | חינם (Free tier מספיק) |
| חשבון Vercel מחובר ל-GitHub | https://vercel.com | חינם (Hobby) |
| חשבון Upstash (Redis ל-rate limit) | https://upstash.com | חינם; **אופציונלי** — בלעדיו יש מימוש in-memory |

הקוד נפרס מ-`trtrhtv/perspectipedia`, ענף `main` (מזגו את ענף הפיתוח לפני פריסה).

## שלב 1 — Neon: מסד הנתונים

1. צרו פרויקט חדש ב-Neon (אזור: `eu-central-1` או הקרוב לקהל).
2. העתיקו את ה-**connection string** (עם `?sslmode=require`) — זה יהיה `DATABASE_URL`.
3. הריצו את המיגרציה מקומית מול Neon (חד-פעמי):
   ```bash
   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" npm run db:migrate
   ```
   זה מריץ את `prisma/migrations/` (המיגרציה המרכזת של PLAN 2.1) — יוצר את כל הטבלאות.
4. (רשות) ערך-דוגמה לבדיקה: `DATABASE_URL="..." node scripts/seed.mjs`

## שלב 2 — Vercel: הפרויקט

1. **Add New → Project** → ייבוא `trtrhtv/perspectipedia`.
2. Framework: Next.js (מזוהה אוטומטית). Build command: ברירת המחדל (`npm run build` —
   כולל `prisma generate`).
3. **Environment Variables** — לפי הטבלה:

| משתנה | ערך | חובה? |
|---|---|---|
| `DATABASE_URL` | ה-connection string של Neon | ✔ |
| `ADMIN_TOKEN` | מחרוזת אקראית ארוכה (למשל `openssl rand -hex 24`) | ✔ |
| `GEN_DAILY_CAP` | `100` | מומלץ (יש ברירת מחדל) |
| `RATE_LIMIT_CREATES_PER_HOUR` | `3` | מומלץ (יש ברירת מחדל) |
| `RATE_LIMIT_REPORTS_PER_HOUR` | `10` | מומלץ (יש ברירת מחדל) |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | מ-Upstash | מומלץ בפרוד (בלעדיהם: in-memory) |
| `ANTHROPIC_API_KEY` | — **לא מגדירים בפריסת ה-read-only** | ✖ (M4) |
| `ENABLE_TOPIC_GATE` | `0` (יהפוך ל-`1` ב-M4, עם מפתח) | ✖ |
| `ENABLE_SEMANTIC_NORMALIZE` | `0` (M4) | ✖ |
| `ENABLE_SYMMETRY_AUDIT` | `0` (יהפוך ל-`1` אחרי eval — PLAN 3.7) | ✖ |

4. **Deploy.**

### הערת maxDuration
`/api/entry` מבקש `maxDuration = 300` (יצירת Opus אורכת דקות). ב-Hobby ייתכן שהתקרה
נמוכה יותר — זה רלוונטי **רק כשמדליקים יצירה** (M4). לפריסת read-only אין השפעה.
כשמגיעים ל-M4: או Vercel Pro, או לוודא שתקרת ה-Fluid Compute של החשבון ≥ 300s.

## שלב 3 — אימות הפריסה (צ'קליסט)

```bash
BASE=https://<project>.vercel.app
curl -s -o /dev/null -w "%{http_code}\n" $BASE            # 200 — דף בית
curl -s -o /dev/null -w "%{http_code}\n" $BASE/library    # 200 — הספרייה
curl -s -o /dev/null -w "%{http_code}\n" $BASE/method     # 200 — דף השקיפות
# יצירה סגורה בחן (read-only): מצפים 503 עם code=no_api_key
curl -s -X POST $BASE/api/entry -H 'Content-Type: application/json' -d '{"topic":"נושא חדש"}'
# admin דורש token: מצפים 401 בלי, 200 עם
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/admin/entries
curl -s -o /dev/null -w "%{http_code}\n" -H "x-admin-token: $ADMIN_TOKEN" $BASE/api/admin/entries
```

בדפדפן: `/admin` → הזנת ה-token → רואים את הערכים; לינק "דיווח על בעיה" עובד בדף ערך.

## אסור לפרוס בלי (גם read-only)

- [x] `ADMIN_TOKEN` מוגדר — כלי ההסרה המהירה של תוכן בעייתי.
- [x] `GEN_DAILY_CAP` פעיל (ברירת מחדל 100).
- [x] rate limit פעיל (ברירת מחדל 3/שעה; Upstash אם רוצים עמידות ל-cold starts).
- [x] לינק דיווח עובד ומגיע ל-admin.
- [x] `needs_review`/`removed` לא נגישים ציבורית (מובנה בקוד — PLAN 0.1).

## פתיחת יצירה חיה (M4 — לא עכשיו)

רק אחרי baseline eval ונחיתת חוקה v3 (PLAN 3.5–3.7):
1. להוסיף `ANTHROPIC_API_KEY` ב-Vercel.
2. `ENABLE_TOPIC_GATE=1` (השער חוסם אנשים חיים לפני קריאת Opus).
3. אחרי ה-eval: `ENABLE_SYMMETRY_AUDIT=1`.
4. Redeploy, ואימות: יצירת ערך אחד, בדיקת הלוג המובנה (`event:"generation"`) והעלות ב-admin.

## תקלות נפוצות

| סימפטום | סיבה | פתרון |
|---|---|---|
| `P1001 can't reach database` | חסר `?sslmode=require` ב-URL של Neon | להוסיף לסוף ה-connection string |
| build נכשל על prisma | `DATABASE_URL` לא מוגדר ב-Vercel | להגדיר; `prisma generate` לא צריך DB חי, אבל ה-runtime כן |
| 500 בכל הדפים | מיגרציה לא רצה | `npm run db:migrate` מול ה-DATABASE_URL של הפרוד |
| rate limit "לא עובד" | serverless cold starts מאפסים in-memory | לחבר Upstash |
