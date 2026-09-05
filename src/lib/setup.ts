import { db } from "./db";
import { MIGRATIONS } from "./schema-sql";

/** هل جدول المستخدمين موجود؟ */
export async function schemaReady(): Promise<boolean> {
  try {
    const rows = await db.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM sqlite_master WHERE type='table' AND name='User'`);
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * يطبّق ملفات الترحيل غير المطبّقة عبر اتصال Prisma (يعمل على D1 وSQLite)،
 * ويسجّلها في جدول d1_migrations ليتوافق مع wrangler.
 */
export async function applyMigrations(): Promise<string[]> {
  // بلا AUTOINCREMENT: إنشاؤه يستلزم جدول sqlite_sequence الذي يمنعه D1 من داخل التطبيق
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const applied = new Set((await db.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM d1_migrations`)).map((r) => r.name));
  const done: string[] = [];
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    const statements = m.sql
      .split(/;\s*\n/)
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    for (const st of statements) await db.$executeRawUnsafe(st);
    await db.$executeRawUnsafe(`INSERT INTO d1_migrations (name) VALUES ('${m.name.replace(/'/g, "''")}')`);
    done.push(m.name);
  }
  return done;
}

export async function needsSetup(): Promise<boolean> {
  if (!(await schemaReady())) return true;
  return (await db.user.count()) === 0;
}
