import { db } from "./db";
import { MIGRATIONS } from "./schema-sql";
import { BUDGET, WEEKS } from "./program";

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

/** يبذر بيانات الخطة القابلة للتعديل (الأسابيع والميزانية) إن لم تكن موجودة */
export async function ensureProgramData(): Promise<void> {
  if ((await db.programWeek.count()) === 0) {
    for (const w of WEEKS) {
      await db.programWeek.create({
        data: {
          number: w.number, label: w.label, hijri: w.hijri, gregorian: w.gregorian,
          competency: w.competency, session: w.session, circle: w.circle, reading: w.reading, task: w.task,
        },
      });
    }
  }
  if ((await db.budgetEntry.count()) === 0) {
    let order = 0;
    for (const i of BUDGET.items) {
      await db.budgetEntry.create({ data: { item: i.item, basis: i.basis, planned: i.cost, optional: i.optional, note: i.note === "—" ? null : i.note, order: order++ } });
    }
  }
}

let bootPromise: Promise<void> | null = null;

/**
 * تُنفَّذ مرة واحدة في كل نسخة عاملة: تطبّق أي ترحيل جديد لم يُطبَّق بعد،
 * ثم تبذر بيانات الخطة. بهذا تصل التحديثات إلى قاعدة تعمل بلا تدخل يدوي.
 */
export function ensureSchema(): Promise<void> {
  bootPromise ??= (async () => {
    try {
      const applied = await applyMigrations();
      if (applied.length) console.log("applied migrations:", applied.join(", "));
      await ensureProgramData();
    } catch (e) {
      bootPromise = null;
      console.error("schema boot failed:", (e as Error).message);
    }
  })();
  return bootPromise;
}
