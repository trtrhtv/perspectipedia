// יצירת slug דטרמיניסטי מנושא — משמש גם ב-client וגם ב-server
// כדי ששני הצדדים יגיעו לאותו מפתח.

export function topicToSlug(topic: string): string {
  return topic
    .trim()
    .toLowerCase()
    .replace(/["'’“”.,;:!?()[\]{}]/g, "") // הסרת פיסוק
    .replace(/\s+/g, "-") // רווחים → מקפים
    .replace(/-+/g, "-") // איחוד מקפים
    .replace(/^-|-$/g, ""); // מקפים בקצוות
}

// שחזור טקסט קריא מ-slug (כשאין את הנושא המקורי)
export function slugToTopic(slug: string): string {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}
