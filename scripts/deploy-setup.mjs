// רץ בתחילת ה-build של Vercel (ראו vercel.json): מיגרציות + seed-אם-ריק.
// מיגרציות רצות מול חיבור ישיר (DIRECT_DATABASE_URL) — ה-pooler של Neon לא מתאים
// ל-prisma migrate; ה-runtime משתמש ב-DATABASE_URL הרגיל (pooled).
import { execSync } from "node:child_process";

const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!directUrl) {
  console.error("deploy-setup: חסר DATABASE_URL");
  process.exit(1);
}

console.log("deploy-setup: prisma migrate deploy…");
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: directUrl },
});

console.log("deploy-setup: prisma generate…");
execSync("npx prisma generate", { stdio: "inherit" });

// seed רק אם אין אף ערך — לא דורסים עריכות admin בפריסות חוזרות.
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const count = await prisma.entry.count();
await prisma.$disconnect();
if (count === 0) {
  console.log("deploy-setup: DB ריק — מריץ seed…");
  execSync("node scripts/seed.mjs", { stdio: "inherit" });
} else {
  console.log(`deploy-setup: ${count} ערכים קיימים — מדלג על seed.`);
}
