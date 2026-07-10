import type { MetadataRoute } from "next";
import { listEntries } from "@/lib/entryService";

// sitemap דינמי (PRE_KEY 1.2) — רק ערכים מפורסמים + דפי הקבע.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");

  const entries = await listEntries();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/library`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/method`, changeFrequency: "monthly", priority: 0.5 },
    ...entries.map((e) => ({
      url: `${base}/entry/${encodeURIComponent(e.slug)}`,
      lastModified: e.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
