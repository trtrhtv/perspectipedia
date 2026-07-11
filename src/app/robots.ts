import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/siteUrl";

// robots (PRE_KEY 1.2) — admin ו-API מחוץ לתחום; sitemap מוצהר.
export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
