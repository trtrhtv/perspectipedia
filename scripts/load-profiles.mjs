// טעינת פרופילי עדשה (D10, PLAN 4.11) מ-profiles/*.json ל-DB (upsert לפי key).
// גרסה עולה אוטומטית כשקובץ השתנה; אישור-אינסיינדר מתאפס כשהתוכן משתנה.
// שימוש: node scripts/load-profiles.mjs
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dir = new URL("../profiles", import.meta.url).pathname;

const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
for (const file of files) {
  const p = JSON.parse(await readFile(path.join(dir, file), "utf8"));
  const data = {
    locale: p.locale ?? "he",
    name: p.name,
    family: p.family,
    role: p.role,
    canon: p.canon,
    register: p.register,
    internalDebates: p.internalDebates,
    voice: p.voice ?? "first-person",
    redFlags: p.redFlags,
  };

  const existing = await prisma.lensProfile.findUnique({ where: { key: p.key } });
  if (!existing) {
    await prisma.lensProfile.create({ data: { key: p.key, ...data, status: p.status ?? "draft" } });
    console.log(`created  ${p.key} v1`);
    continue;
  }

  const changed = JSON.stringify(data) !== JSON.stringify({
    locale: existing.locale, name: existing.name, family: existing.family, role: existing.role,
    canon: existing.canon, register: existing.register, internalDebates: existing.internalDebates,
    voice: existing.voice, redFlags: existing.redFlags,
  });
  if (!changed) {
    console.log(`ok       ${p.key} v${existing.version} (ללא שינוי)`);
    continue;
  }
  // תוכן השתנה → גרסה עולה, והאישור מתאפס: אינסיינדר חתם על הגרסה הקודמת בלבד.
  await prisma.lensProfile.update({
    where: { key: p.key },
    data: { ...data, version: existing.version + 1, status: "draft", approvedBy: null, approvedAt: null },
  });
  console.log(`updated  ${p.key} v${existing.version + 1} (אישור אופס — נדרשת חתימה מחדש)`);
}

const all = await prisma.lensProfile.findMany({ select: { key: true, version: true, status: true } });
console.log("\nprofiles:", all);
await prisma.$disconnect();
