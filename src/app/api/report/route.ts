import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { limitReport } from "@/lib/ratelimit";

// דיווח קורא על בעיה/הטיה (PLAN 1.4). rate-limited; נשמר לתור ה-admin.

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const rl = await limitReport(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "נשלחו יותר מדי דיווחים. נסו שוב מאוחר יותר." },
      { status: 429 }
    );
  }

  let body: { slug?: string; lensName?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  const slug = (body.slug ?? "").toString().trim();
  const reason = (body.reason ?? "").toString().trim();
  const lensName = (body.lensName ?? "").toString().trim() || null;

  if (!slug || !reason) {
    return NextResponse.json({ error: "חסר נושא הדיווח או תוכן." }, { status: 400 });
  }
  if (reason.length > 2000) {
    return NextResponse.json({ error: "הדיווח ארוך מדי." }, { status: 400 });
  }

  const entry = await prisma.entry.findUnique({ where: { slug }, select: { id: true } });
  if (!entry) return NextResponse.json({ error: "ערך לא נמצא." }, { status: 404 });

  await prisma.report.create({
    data: { entryId: entry.id, lensName, reason },
  });

  return NextResponse.json({ ok: true });
}
