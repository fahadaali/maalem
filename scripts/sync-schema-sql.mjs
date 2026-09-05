// يولّد src/lib/schema-sql.ts من ملفات الترحيل في migrations/ لتستخدمه صفحة الإعداد الأولي على D1
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const files = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();
const entries = files.map((f) => ({ name: f, sql: readFileSync(`migrations/${f}`, "utf8") }));
const out = `// ملف مولَّد تلقائياً من migrations/ — لا تعدّله يدوياً (npm run sync:schema)
export const MIGRATIONS: { name: string; sql: string }[] = ${JSON.stringify(entries, null, 2)};
`;
writeFileSync("src/lib/schema-sql.ts", out);
console.log(`synced ${files.length} migration(s) into src/lib/schema-sql.ts`);
