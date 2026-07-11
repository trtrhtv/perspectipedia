// כתובת הבסיס של האתר — מקור אמת אחד ל-layout (metadataBase), sitemap ו-robots.
// סדר עדיפות: override ידני → דומיין הפרודקשן של Vercel → פיתוח מקומי.
export function siteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}
