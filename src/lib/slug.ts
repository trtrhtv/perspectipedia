// יצירת slug דטרמיניסטי מנושא — משמש גם ב-client וגם ב-server
// כדי ששני הצדדים יגיעו לאותו מפתח.

// נרמול תצוגה: ניקוד, גרשיים עבריים, רווחים כפולים (PLAN 1.5א).
export function normalizeTopic(topic: string): string {
  return topic
    .replace(/[֑-ׇ]/g, "") // ניקוד וטעמים
    .replace(/[׳״]/g, "") // גרש וגרשיים עבריים (צה״ל → צהל)
    .replace(/\s+/g, " ") // רווחים כפולים/טאבים
    .trim();
}

export function topicToSlug(topic: string): string {
  return normalizeTopic(topic)
    .toLowerCase()
    .replace(/["'’“”.,;:!?()[\]{}]/g, "") // הסרת פיסוק
    .replace(/\s+/g, "-") // רווחים → מקפים
    .replace(/-+/g, "-") // איחוד מקפים
    .replace(/^-|-$/g, ""); // מקפים בקצוות
}

// וריאנט ה"א-הידיעה: "השואה" ↔ "שואה". משמש רק כ-fallback בחיפוש —
// התאמה מדויקת תמיד גוברת, כך ש"הלכה" לא תמופה בטעות ל"לכה" אם "הלכה" קיימת.
export function heVariantSlug(slug: string): string | null {
  if (slug.startsWith("ה") && slug.length > 2) return slug.slice(1);
  if (/^[א-ת]/.test(slug) && !slug.startsWith("ה")) return "ה" + slug;
  return null;
}

// שחזור טקסט קריא מ-slug (כשאין את הנושא המקורי)
export function slugToTopic(slug: string): string {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}
