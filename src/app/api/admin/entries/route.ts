import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthorized } from "@/lib/adminAuth";

// API הניהול (PLAN 1.3): רשימה מלאה (כל המצבים), שינוי מצב, מחיקה.
// כל הפעולות דורשות ADMIN_TOKEN.

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized();

  const entries = await prisma.entry.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      topic: true,
      status: true,
      refusalReason: true,
      promptVersion: true,
      model: true,
      costUsd: true,
      createdAt: true,
      lenses: { select: { name: true }, orderBy: { order: "asc" } },
      reports: {
        where: { status: "open" },
        select: { id: true, lensName: true, reason: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const totalCostUsd = entries.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
  return NextResponse.json({ entries, totalCostUsd });
}

const ALLOWED_STATUS = new Set(["published", "needs_review", "removed"]);

export async function PATCH(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized();

  let body: { slug?: string; status?: string; resolveReports?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }
  const slug = (body.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "חסר slug." }, { status: 400 });

  const entry = await prisma.entry.findUnique({ where: { slug } });
  if (!entry) return NextResponse.json({ error: "ערך לא נמצא." }, { status: 404 });

  if (body.status) {
    if (!ALLOWED_STATUS.has(body.status)) {
      return NextResponse.json({ error: "מצב לא חוקי." }, { status: 400 });
    }
    await prisma.entry.update({ where: { slug }, data: { status: body.status } });
  }

  if (body.resolveReports) {
    await prisma.report.updateMany({
      where: { entryId: entry.id, status: "open" },
      data: { status: "resolved" },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized();

  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  if (!slug) return NextResponse.json({ error: "חסר slug." }, { status: 400 });

  // מחיקה קשה — משחררת את ה-slug (בניגוד ל-removed ששומר אותו תפוס).
  await prisma.entry.delete({ where: { slug } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
