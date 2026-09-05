// بذر D1 عن بُعد أو محلياً: يولّد SQL لحساب مدير المشروع والمهام والاختبارات ثم ينفّذه عبر wrangler
// الاستخدام: node scripts/d1-seed.mjs [--remote] [--password=Admin@1448]
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";

const remote = process.argv.includes("--remote");
const pwdArg = process.argv.find((a) => a.startsWith("--password="));
const password = pwdArg ? pwdArg.split("=")[1] : "Admin@1448";
const { WEEKS } = await import("../src/lib/program.ts");

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const id = () => "c" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
const DAY = 86400000;
const start = new Date("2026-09-12T00:00:00+03:00");
const hash = await bcrypt.hash(password, 10);
const lines = [
  `INSERT OR IGNORE INTO "User" (id, username, name, passwordHash, role, active, createdAt) VALUES (${q(id())}, 'admin', 'مدير المشروع', ${q(hash)}, 'ADMIN', 1, CURRENT_TIMESTAMP);`,
];
for (const w of WEEKS.filter((x) => x.number >= 0 && x.number <= 12)) {
  const due = new Date(start.getTime() + w.number * 7 * DAY + (w.number === 0 ? 3 * DAY + 22 * 3600000 : 5 * DAY + 22 * 3600000));
  lines.push(`INSERT INTO "Assignment" (id, week, title, description, competency, dueAt, createdAt) SELECT ${q(id())}, ${w.number}, ${q(w.task)}, ${q(`المهمة الأسبوعية للأسبوع ${w.label}.`)}, ${q(w.competency)}, ${due.getTime()}, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM "Assignment" WHERE week = ${w.number});`);
}
for (let i = 1; i <= 6; i++) lines.push(`INSERT INTO "Quiz" (id, title, kind, week, passMark, published, createdAt) SELECT ${q(id())}, ${q(`اختبار فقهي ${i}`)}, 'FIQH', ${i}, 70, 0, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM "Quiz" WHERE title = ${q(`اختبار فقهي ${i}`)});`);
for (const i of [2, 4, 6, 8]) lines.push(`INSERT INTO "Quiz" (id, title, kind, week, passMark, published, createdAt) SELECT ${q(id())}, ${q(`اختبار المحفوظ ${i / 2}`)}, 'QURAN', ${i}, 70, 0, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM "Quiz" WHERE title = ${q(`اختبار المحفوظ ${i / 2}`)});`);

writeFileSync(".data-seed.sql", lines.join("\n"));
execSync(`npx wrangler d1 execute maalem-db ${remote ? "--remote" : "--local"} --file=.data-seed.sql`, { stdio: "inherit" });
console.log(`Seeded ${remote ? "remote" : "local"} D1. admin / ${password}`);
