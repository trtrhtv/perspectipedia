import { NextResponse } from "next/server";
import { getEntryResultBySlug } from "@/lib/entryService";

// endpoint ה-polling (PLAN 5.1): קריאה בלבד — מחזיר את מצב הערך. לעולם לא מייצר.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const result = await getEntryResultBySlug(slug);
  if (!result || result.kind === "removed") {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  switch (result.kind) {
    case "entry":
      return NextResponse.json({ status: "ready", entry: result.entry });
    case "pending":
      return NextResponse.json({ status: "pending" });
    case "pending_review":
      return NextResponse.json({ status: "pending_review" });
    case "refused":
      return NextResponse.json({ status: "refused", reason: result.reason });
    case "failed":
      return NextResponse.json({ status: "failed" });
    case "rate_limited": // לא אמור לקרות בקריאה — ליתר ביטחון
    case "capped":
      return NextResponse.json({ status: "pending" });
  }
}
