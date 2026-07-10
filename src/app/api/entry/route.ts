import { NextResponse, after } from "next/server";
import { getOrCreateEntry, processPendingEntry } from "@/lib/entryService";
import { MissingApiKeyError } from "@/lib/claude";

// היצירה עצמה רצה ב-after() אחרי החזרת ה-202 — אבל חולקת את חלון הפונקציה.
export const maxDuration = 300;

export async function POST(request: Request) {
  let topic: string;
  let depth: "summary" | "standard";
  try {
    const body = await request.json();
    topic = (body?.topic ?? "").toString().trim();
    // בחירת עומק של הקורא (D7) — deep שמור ל-admin בלבד.
    depth = body?.depth === "summary" ? "summary" : "standard";
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  if (!topic) {
    return NextResponse.json({ error: "חסר נושא." }, { status: 400 });
  }
  if (topic.length > 120) {
    return NextResponse.json({ error: "הנושא ארוך מדי." }, { status: 400 });
  }

  // IP לזיהוי rate limit — הערך הראשון ב-x-forwarded-for (מאחורי proxy כמו Vercel).
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  try {
    const result = await getOrCreateEntry(topic, { ip, depth });

    switch (result.kind) {
      case "entry":
        return NextResponse.json({ entry: result.entry });
      case "pending":
        // מי שקנה את המנעול מריץ את העבודה — אחרי שהתגובה כבר יצאה ללקוח.
        if (result.owned) {
          const slug = result.slug;
          after(() => processPendingEntry(slug));
        }
        return NextResponse.json({ pending: true, slug: result.slug }, { status: 202 });
      case "refused":
        return NextResponse.json({ refused: true, reason: result.reason });
      case "pending_review":
        return NextResponse.json({ pendingReview: true });
      case "failed":
        return NextResponse.json({ failed: true, slug: result.slug });
      case "removed":
        return NextResponse.json({ error: "הערך הוסר." }, { status: 404 });
      case "rate_limited":
        return NextResponse.json(
          {
            error: "יצרתם כמה ערכים בזמן קצר. אפשר להמשיך לקרוא — יצירה נוספת תתאפשר בעוד כשעה.",
            code: "rate_limited",
          },
          {
            status: 429,
            headers: result.retryAfterSeconds
              ? { "Retry-After": String(result.retryAfterSeconds) }
              : undefined,
          }
        );
      case "capped":
        return NextResponse.json(
          {
            error: "הגענו למכסת הערכים החדשים להיום. נסו שוב מחר.",
            code: "daily_cap",
          },
          { status: 429 }
        );
    }
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message, code: "no_api_key" }, { status: 503 });
    }
    console.error("entry generation failed:", err);
    const message = err instanceof Error ? err.message : "יצירת הערך נכשלה.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
