# perspectipedia — מסמך ארכיטקטורה (Architecture)

> גרסה 0.1 · נגזר ממסמך האפיון · מתאר את v1
>
> **הערה (2026-07-10):** מסמך זה מתאר את v1 כפי שנבנה. **ארכיטקטורת היעד** — המצב
> הסופי שאליו בונים (מודל נתונים מלא, מכונת מצבים, צנרת יצירה, נקודות הרחבה) — מוגדרת
> ב-**`docs/ARCHITECTURE_TARGET.md`**, וסדר הביצוע ב-`docs/ENGINEERING_PLAN.md`.
> היכן שיש פער (למשל זרימת ה-fetch היחיד בסעיף 5 כאן, או מודל הנתונים בסעיף 4) —
> מסמך היעד גובר.

---

## 1. סקירה כללית

perspectipedia הוא **אתר Next.js** שבו משתמש מקליד נושא, מנוע **Claude Opus 4.8** מייצר
עבורו קבוצת **עדשות מבוססות**, התוצאה **נשמרת ב-SQLite**, והמשתמש קורא ומשווה.

```
┌────────────┐   נושא    ┌─────────────────────┐   קיים?   ┌──────────┐
│  Browser   │ ────────▶ │  Next.js API Route  │ ────────▶ │  SQLite  │
│ (React/RTL)│ ◀──────── │  /api/entry         │ ◀──────── │ (Prisma) │
└────────────┘   ערך     └──────────┬──────────┘   ערך     └──────────┘
                                    │ לא קיים?
                                    ▼
                          ┌───────────────────┐
                          │  Claude Opus 4.8  │  ← מייצר עדשות + ביסוס
                          │ (@anthropic-ai)   │     (structured output)
                          └───────────────────┘
```

---

## 2. עקרון מנחה: הארכיטקטורה משרתת את "מבחן הביסוס"

כל החלטה טכנית נגזרת מעקרונות-העל של האפיון. במיוחד: **מבחן הביסוס** ממומש כ**סכמת פלט
מובנה (JSON Schema)** שה-LLM חייב למלא — כל עדשה *מחויבת* לספק `grounding` ו-`epistemic_type`.
המודל לא יכול "לשכוח" את הביסוס, כי הסכמה דורשת אותו.

---

## 3. מבנה הפרויקט (תיקיות)

```
perspectipedia/
├── docs/
│   ├── PRODUCT_SPEC.md
│   └── ARCHITECTURE.md
├── prisma/
│   └── schema.prisma          # מודל הנתונים
├── src/
│   ├── app/
│   │   ├── page.tsx           # דף בית (חיפוש + נושאי דוגמה)
│   │   ├── entry/[slug]/
│   │   │   └── page.tsx       # דף ערך (בורר עדשות + השוואה)
│   │   ├── api/
│   │   │   └── entry/route.ts # יצירה/שליפה של ערך
│   │   ├── layout.tsx         # RTL, עברית, גופנים
│   │   └── globals.css        # Tailwind + RTL
│   ├── lib/
│   │   ├── claude.ts          # לקוח Anthropic + לוגיקת יצירה
│   │   ├── prompts.ts         # הנחיות המערכת (מקודדות את העקרונות)
│   │   ├── schema.ts          # JSON Schema של הערך (מבחן הביסוס)
│   │   └── db.ts              # לקוח Prisma
│   └── components/
│       ├── SearchBox.tsx
│       ├── LensSwitcher.tsx   # בורר עדשות
│       ├── LensView.tsx       # תצוגת עדשה + חלונית ביסוס
│       └── CompareView.tsx    # מצב השוואה
├── .env.local                 # ANTHROPIC_API_KEY (לא ב-git)
├── .gitignore
├── package.json
└── README.md
```

---

## 4. מודל הנתונים (Prisma / SQLite)

```prisma
model Entry {
  id        String   @id @default(cuid())
  slug      String   @unique   // נגזר מהנושא, לחיפוש ולקישור
  topic     String              // הנושא כפי שהוקלד ("בריאת העולם")
  lenses    Lens[]
  createdAt DateTime @default(now())
}

model Lens {
  id            String @id @default(cuid())
  entryId       String
  entry         Entry  @relation(fields: [entryId], references: [id])
  name          String            // "יהדות דתית"
  family        String            // דתית / מדעית / פילוסופית / פוליטית / תרבותית / היסטורית
  summary       String            // תמצית 1-2 משפטים
  body          String            // גוף הערך מהעדשה הזו
  grounding     String            // JSON: רשימת מקורות + הסבר ("על מה זה מבוסס")
  epistemicType String            // נרטיב-משמעות / עמדה-ערכית / טענה-אמפירית / ביקורת-מתודולוגית
  confidence    String?           // סייג, למשל "הצגה כללית; יש מחלוקות פנימיות"
  order         Int               // סדר תצוגה
}
```

*הערה:* `grounding` נשמר כ-JSON string ב-SQLite (אין שדה JSON טבעי). ב-Postgres נעבור ל-`Json`.

---

## 5. זרימת היצירה (Generation Flow)

כשמגיע נושא ל-`/api/entry`:

1. **normalize** — מנרמלים את הנושא ל-`slug` (למשל "בריאת העולם" → `בריאת-העולם`).
2. **cache check** — מחפשים ב-SQLite לפי `slug`. אם קיים → מחזירים מיד (מהיר, עקבי).
3. **generate** — אם לא קיים, קוראים ל-Claude Opus 4.8 עם:
   - **הנחיית מערכת** שמקודדת את 4 עקרונות-העל (מבחן הביסוס, עדשות תלויות-נושא, מסגור
     מכבד, הבחנה עובדה/פרשנות).
   - **structured output** (`output_config.format`) עם ה-JSON Schema של הערך — כך המודל
     *חייב* להחזיר עדשות עם `grounding` ו-`epistemic_type`.
   - **adaptive thinking + effort: "high"** — לאיכות וניואנס.
4. **validate** — בודקים שכל עדשה עברה את מבחן הביסוס (יש grounding אמיתי). עדשה בלי
   ביסוס — נזרקת.
5. **persist** — שומרים ב-SQLite.
6. **return** — מחזירים את הערך ל-frontend.

### מדוע מודל אחד ולא שניים
בתחילה שקלנו שני שלבים (הצעת עדשות ← כתיבת כל עדשה). ל-v1 נאחד ל**קריאה אחת מובנית**
שמחזירה את כל העדשות בבת אחת — פשוט יותר, זול יותר, ומספיק טוב. אם נראה בעיות איכות,
נפצל בהמשך.

---

## 6. סכמת הפלט (מבחן הביסוס בקוד)

ה-JSON Schema שהמודל מחויב אליו (מתומצת):

```json
{
  "type": "object",
  "properties": {
    "topic": { "type": "string" },
    "topic_kind": {
      "type": "string",
      "enum": ["meaning", "mixed", "empirical"],
      "description": "האם הנושא הוא שאלת משמעות, מעורב, או עובדתי"
    },
    "lenses": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":          { "type": "string" },
          "family":        { "type": "string", "enum": ["religious","scientific","philosophical","political","cultural","historical"] },
          "summary":       { "type": "string" },
          "body":          { "type": "string" },
          "grounding":     { "type": "array", "items": { "type": "object", "properties": {
                               "source": {"type":"string"}, "explanation": {"type":"string"} },
                               "required": ["source","explanation"], "additionalProperties": false } },
          "epistemic_type":{ "type": "string", "enum": ["meaning-narrative","value-position","empirical-grounded","methodological-critique"] },
          "confidence":    { "type": "string" }
        },
        "required": ["name","family","summary","body","grounding","epistemic_type"],
        "additionalProperties": false
      }
    }
  },
  "required": ["topic","topic_kind","lenses"],
  "additionalProperties": false
}
```

`grounding` הוא **מערך חובה** — זה מה שאוכף את מבחן הביסוס ברמת ה-API.

---

## 7. הנחיית המערכת (System Prompt) — עקרונות-העל בקוד

הנחיית המערכת ל-Claude תקודד במפורש (תמצית):

- אתה בונה ערך אנציקלופדי מרובה-עדשות. **אל תכריע מי צודק** — הצג כל עולם-תוכן בכבוד.
- **מבחן הביסוס:** כלול עדשה *רק* אם היא מנומקת ומבוססת (מקור/מסורת/ראיה/היגיון קוהרנטי).
  אל תמציא. אל תכניס עמדות חסרות ביסוס.
- **עדשות תלויות-נושא:** בחר את העדשות הרלוונטיות *לנושא הזה* (2-5), לא רשימה קבועה.
- **טון:** "כך רואים זאת ב..." ולא "האמת היא...". גוף-ראשון של אותו עולם, בכבוד.
- **עובדה מול פרשנות:** אם הנושא עובדתי (`topic_kind: empirical`) — אל תכתוב עובדות שגויות
  בשם "נקודת מבט". מותר לכלול ביקורת מתודולוגית *מנומקת* כעדשה נפרדת.
- לכל עדשה: מלא `grounding` אמיתי וספציפי, וסמן `epistemic_type`.
- כתוב בעברית תקנית וברורה.

---

## 8. ה-Frontend

- **RTL מלא** — `dir="rtl"` ב-layout, גופן עברי נקי (למשל Assistant/Rubik דרך next/font).
- **דף בית:** שדה חיפוש גדול, 3-4 נושאי דוגמה מוכנים ("בריאת העולם", "מהו צדק", "מהו מוות"),
  משפט הסבר על המוצר.
- **דף ערך:**
  - כותרת הנושא + סימון `topic_kind` אם רלוונטי.
  - **בורר עדשות** (טאבים/כפתורים) — לחיצה מחליפה תוכן.
  - **תצוגת עדשה:** summary → body → חלונית **"על מה זה מבוסס"** (grounding).
  - כפתור **"השוואה"** → שתי עדשות בשתי עמודות, כל צד ניתן להחלפה.
- **מצב טעינה:** כשנושא נוצר לראשונה — אינדיקציה "בונים את הערך..." (עם streaming בהמשך).

---

## 9. ניהול סודות ואבטחה

- `ANTHROPIC_API_KEY` ב-`.env.local` בלבד (ב-`.gitignore`). **לעולם לא בקוד ולא ב-git.**
- קריאות ה-LLM **רק מה-backend** (API route) — המפתח לא נחשף ל-browser.
- **rate limiting** בסיסי על `/api/entry` (למנוע ניצול/עלויות) — אפשר להוסיף ב-v1.5.

---

## 10. עלויות (הערכה גסה)

Claude Opus 4.8: $5 / 1M input, $25 / 1M output. ערך טיפוסי (5 עדשות עם ביסוס) ≈ כמה אלפי
טוקני פלט → סדר גודל של סנטים בודדים לערך. **שמירת הערכים חוסכת** — כל נושא מיוצר פעם אחת
בלבד, ואז מוגש מהמסד בחינם.

---

## 11. מה מחוץ ל-v1 (תזכורת)

חשבונות, עריכה קהילתית, אימות מקורות אוטומטי, ריבוי שפות, מובייל ייעודי. ראה מפת הדרכים
באפיון.

---

## 12. סדר בנייה מוצע (Build Order)

1. שלד Next.js + TypeScript + Tailwind + RTL + גופן עברי.
2. Prisma + SQLite + סכמה + migration.
3. `lib/claude.ts` + `prompts.ts` + `schema.ts` — מנוע היצירה.
4. `/api/entry` — cache check → generate → persist → return.
5. דף בית + SearchBox.
6. דף ערך + LensSwitcher + LensView (עם חלונית ביסוס).
7. מצב השוואה (CompareView).
8. ליטוש עיצוב + נושאי דוגמה + בדיקה מקצה לקצה.

---

*המסמך הזה חי. ישתנה ככל שנלמד תוך כדי בנייה.*
