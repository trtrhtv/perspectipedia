import { NextResponse } from "next/server";
import { getOrCreateEntry } from "@/lib/entryService";
import { MissingApiKeyError } from "@/lib/claude";

// יצירת ערך יכולה לקחת זמן (adaptive thinking) — נותנים חלון רחב.
export const maxDuration = 300;

export async function POST(request: Request) {
  let topic: string;
  try {
    const body = await request.json();
    topic = (body?.topic ?? "").toString().trim();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  if (!topic) {
    return NextResponse.json({ error: "חסר נושא." }, { status: 400 });
  }
  if (topic.length > 120) {
    return NextResponse.json({ error: "הנושא ארוך מדי." }, { status: 400 });
  }

  try {
    const result = await getOrCreateEntry(topic);

    switch (result.kind) {
      case "entry":
        return NextResponse.json({ entry: result.entry });
      case "refused":
        return NextResponse.json({ refused: true, reason: result.reason });
      case "pending_review":
        return NextResponse.json({ pendingReview: true });
      case "removed":
        return NextResponse.json({ error: "הערך הוסר." }, { status: 404 });
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
