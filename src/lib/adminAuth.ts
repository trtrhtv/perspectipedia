import { createHash, timingSafeEqual } from "node:crypto";

// אימות admin — מודול יחיד (ה-seam לחשבונות אמיתיים בעתיד, ARCHITECTURE_TARGET §7).
// token יחיד ב-env; מתקבל ב-header (API) או ב-cookie (דף ה-admin).

// השוואה קבועת-זמן: hash של שני הצדדים משווה אורכים ומנטרל דליפת-תזמון (ממצא ביקורת).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isAdminAuthorized(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.trim() === "") return false; // בלי token מוגדר — אין גישת admin בכלל

  const header = request.headers.get("x-admin-token");
  if (header && safeEqual(header, token)) return true;

  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(/(?:^|;\s*)admin_token=([^;]+)/);
  if (match) {
    // cookie זדוני עם קידוד שבור אסור שיפיל את ה-route ל-500 — פשוט לא מאומת.
    let value = match[1];
    try {
      value = decodeURIComponent(match[1]);
    } catch {
      return false;
    }
    if (safeEqual(value, token)) return true;
  }

  return false;
}
