// אימות admin — מודול יחיד (ה-seam לחשבונות אמיתיים בעתיד, ARCHITECTURE_TARGET §7).
// token יחיד ב-env; מתקבל ב-header (API) או ב-cookie (דף ה-admin).

export function isAdminAuthorized(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.trim() === "") return false; // בלי token מוגדר — אין גישת admin בכלל

  const header = request.headers.get("x-admin-token");
  if (header && header === token) return true;

  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(/(?:^|;\s*)admin_token=([^;]+)/);
  if (match && decodeURIComponent(match[1]) === token) return true;

  return false;
}
