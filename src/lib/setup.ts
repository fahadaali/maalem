import { db } from "./db";
import { MIGRATIONS } from "./schema-sql";
import { BUDGET, PROGRAM, WEEKS, BOOKS, CHARTER, CONTINUOUS_ASSESSMENT, PROJECT_RUBRIC, COMPLETION_LEVELS, COMPETENCIES } from "./program";

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
 * جدول أنشأه ترحيل بعينه: وجوده يعني أن كل ترحيل حتى ذلك الملف مطبَّق.
 * تُسجَّل هذه وحدها كمطبَّقة، ويبقى ما بعدها ليُنفَّذ — فترحيلٌ لاحق لا ينشئ جدولاً
 * (كإضافة عمود) لا يُبتلع بالتسجيل فيغيب أثره عن القاعدة.
 */
const BASELINE_SENTINEL = { table: "ExcuseRequest", through: "0009_question_bank_and_excuses.sql" };

async function tableExists(name: string): Promise<boolean> {
  try {
    const rows = await db.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`);
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
  /**
   * قاعدة أُنشئت بـ prisma db push (المسار المحلي في README): جداولها كاملة على
   * آخر صورة للمخطط، لكن لا سجل لها في d1_migrations. تنفيذ الترحيلات عليها
   * يفشل من أول تعليمة — بل قد يُتلفها لأن بعضها يعيد بناء الجداول — فكان الإقلاع
   * يفشل في كل طلب ولا تُبذر بيانات الخطة أبداً. فتُسجَّل الترحيلات كلها كمطبَّقة
   * دون تنفيذ، بشرط وجود آخر ما أضافته الترحيلات فعلاً.
   */
  if (applied.size === 0 && (await schemaReady()) && (await tableExists(BASELINE_SENTINEL.table))) {
    // أسماء الملفات مرقَّمة بأصفار بادئة، فمقارنة النصوص ترتيبٌ صحيح
    const baselined = MIGRATIONS.filter((m) => m.name <= BASELINE_SENTINEL.through);
    for (const m of baselined) {
      await db.$executeRawUnsafe(`INSERT INTO d1_migrations (name) VALUES ('${m.name.replace(/'/g, "''")}')`);
      applied.add(m.name);
    }
    console.log("migrations baselined:", baselined.length);
  }
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    const statements = m.sql
      .split(/;\s*\n/)
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    for (const st of statements) {
      // بعض تعليمات PRAGMA لا تقبلها D1 من داخل التطبيق، وهي إرشادية هنا
      if (/^PRAGMA\s/i.test(st)) {
        await db.$executeRawUnsafe(st).catch(() => {});
        continue;
      }
      /**
       * عمودٌ أضافه prisma db push قبل أن يجري ترحيله — وهو المسار المحلي في
       * README — ليس خطأً يوقف الإقلاع: المطلوب حاصل. ولولا التجاوز لفشل الإقلاع
       * في كل طلب ولم تُبذر بيانات الخطة أبداً.
       */
      if (/^ALTER\s+TABLE[\s\S]+ADD\s+COLUMN/i.test(st)) {
        await db.$executeRawUnsafe(st).catch((e: unknown) => {
          if (!/duplicate column/i.test(String((e as Error)?.message ?? e))) throw e;
        });
        continue;
      }
      /**
       * وكذلك جدولٌ أو فهرسٌ أنشأه prisma db push قبل ترحيله: «موجود سلفاً» ليس
       * خطأً يوقف الإقلاع، فالمطلوب حاصل. ولولا التجاوز لفشل الإقلاع في كل طلب
       * ولم تُبذر بيانات الخطة أبداً — كما وقع فعلاً مع أول ترحيلٍ ينشئ جدولاً
       * بعد اعتماد هذا المسار في README.
       */
      if (/^CREATE\s+(TABLE|(UNIQUE\s+)?INDEX)/i.test(st)) {
        await db.$executeRawUnsafe(st).catch((e: unknown) => {
          if (!/already exists/i.test(String((e as Error)?.message ?? e))) throw e;
        });
        continue;
      }
      await db.$executeRawUnsafe(st);
    }
    await db.$executeRawUnsafe(`INSERT INTO d1_migrations (name) VALUES ('${m.name.replace(/'/g, "''")}')`);
    done.push(m.name);
  }
  return done;
}

export async function needsSetup(): Promise<boolean> {
  if (!(await schemaReady())) return true;
  return (await db.user.count()) === 0;
}

/**
 * تهيئة الدفعة: تُنشأ الدفعة الأولى من الخطة، ويُنسب إليها كل ما لا دفعة له.
 * بهذا تنتقل قاعدة قائمة إلى نظام الدفعات دون فقد شيء.
 */
export async function ensureCohort(): Promise<string> {
  const active = await db.cohort.findFirst({ where: { active: true } });
  if (active) return active.id;
  const first = await db.cohort.findFirst({ orderBy: { createdAt: "asc" } });
  if (first) {
    await db.cohort.update({ where: { id: first.id }, data: { active: true } });
    return first.id;
  }
  const created = await db.cohort.create({ data: { name: PROGRAM.cohort, startDate: PROGRAM.startDate, active: true } });
  // نسبة البيانات القائمة إلى الدفعة الأولى
  await Promise.all([
    db.user.updateMany({ where: { cohortId: null }, data: { cohortId: created.id } }),
    db.programWeek.updateMany({ where: { cohortId: null }, data: { cohortId: created.id } }),
    db.assignment.updateMany({ where: { cohortId: null }, data: { cohortId: created.id } }),
    db.quiz.updateMany({ where: { cohortId: null }, data: { cohortId: created.id } }),
    db.budgetEntry.updateMany({ where: { cohortId: null }, data: { cohortId: created.id } }),
    db.guest.updateMany({ where: { cohortId: null }, data: { cohortId: created.id } }),
    db.sessionMinutes.updateMany({ where: { cohortId: null }, data: { cohortId: created.id } }),
    db.programReport.updateMany({ where: { cohortId: null }, data: { cohortId: created.id } }),
    db.surveyResponse.updateMany({ where: { cohortId: null }, data: { cohortId: created.id } }),
  ]);
  return created.id;
}

/** معرّف يُولَّد قبل الكتابة، فتُكتب الكفاءات ومفرداتها دفعةً واحدة */
const newId = () => crypto.randomUUID().replace(/-/g, "");

/** يبذر محتوى الخطة القابل للتعديل إن لم يكن موجوداً: الأسابيع، والكتب، والميثاق، والأوزان، والمستويات، والكفاءات، والميزانية */
export async function ensureProgramData(cohortId: string): Promise<void> {
  // تُكتب البذور بـ createMany: استدعاء واحد لكل جدول بدل استدعاء لكل صف،
  // فبدء التشغيل الأول على D1 لا يبتلع عشرات الرحلات إلى القاعدة.
  if ((await db.programWeek.count({ where: { cohortId } })) === 0) {
    await db.programWeek.createMany({
      data: WEEKS.map((w) => ({
        cohortId,
        number: w.number, label: w.label, hijri: w.hijri, gregorian: w.gregorian,
        competency: w.competency, session: w.session, circle: w.circle, reading: w.reading, task: w.task,
        field: w.field,
      })),
    });
  } else {
    /**
     * الدفعات المبذورة قبل إضافة صف المعايشة تبقى بلا نصّه. يُكمَّل هنا للصفوف
     * الفارغة وحدها، فلا يُطمس ما حرّره المدير بيده.
     */
    for (const w of WEEKS.filter((x) => x.field)) {
      await db.programWeek.updateMany({ where: { cohortId, number: w.number, field: "" }, data: { field: w.field } });
    }
  }
  if ((await db.programBook.count({ where: { cohortId } })) === 0) {
    await db.programBook.createMany({
      data: BOOKS.map((b) => ({ cohortId, order: b.order, title: b.title, author: b.author, pages: b.pages, weeks: b.weeks, circle: b.circle, availability: b.availability })),
    });
  }
  if ((await db.charterItem.count({ where: { cohortId } })) === 0) {
    await db.charterItem.createMany({ data: CHARTER.map((text, order) => ({ cohortId, order, text })) });
  }
  if ((await db.assessmentItem.count({ where: { cohortId } })) === 0) {
    await db.assessmentItem.createMany({
      data: [
        ...CONTINUOUS_ASSESSMENT.map((c, order) => ({ cohortId, kind: "CONTINUOUS", key: c.key, label: c.component, points: c.points, tool: c.tool, minimum: c.minimum, order })),
        ...PROJECT_RUBRIC.map((r, order) => ({ cohortId, kind: "PROJECT", key: r.key, label: r.criterion, points: r.points, description: r.description, order })),
      ],
    });
  }
  if ((await db.completionLevel.count({ where: { cohortId } })) === 0) {
    await db.completionLevel.createMany({ data: COMPLETION_LEVELS.map((l) => ({ cohortId, min: l.min, level: l.level, certificate: l.certificate })) });
  }
  if ((await db.competencyDef.count({ where: { cohortId } })) === 0) {
    const defs = COMPETENCIES.map((c) => ({ id: newId(), source: c }));
    await db.competencyDef.createMany({
      data: defs.map(({ id, source: c }) => ({ id, cohortId, slug: c.slug, order: c.order, name: c.name, weight: c.weight, intro: c.intro ?? "" })),
    });
    await db.competencyItemRow.createMany({
      data: defs.flatMap(({ id, source: c }) =>
        c.items.map((i, order) => ({
          competencyId: id, order, title: i.title, program: i.program, indicator: i.indicator,
          tasks: i.tasks, schedule: i.schedule, cost: i.cost, evidence: i.evidence, refs: i.references.join("\n"),
        })),
      ),
    });
  }
  if ((await db.budgetEntry.count({ where: { cohortId } })) === 0) {
    await db.budgetEntry.createMany({
      data: BUDGET.items.map((i, order) => ({ cohortId, item: i.item, basis: i.basis, planned: i.cost, optional: i.optional, note: i.note === "—" ? null : i.note, order })),
    });
  }
}

let bootPromise: Promise<void> | null = null;

/**
 * تُنفَّذ مرة واحدة في كل نسخة عاملة: تطبّق أي ترحيل جديد لم يُطبَّق بعد،
 * ثم تبذر بيانات الخطة. بهذا تصل التحديثات إلى قاعدة تعمل بلا تدخل يدوي.
 */
/**
 * بصمة الحالة المتوقعة: عدد الترحيلات المعروفة. تتغير كلما أُضيف ترحيل جديد،
 * فتُعاد التهيئة عندها وحدها.
 */
const BOOT_STAMP = `v${MIGRATIONS.length}`;
const BOOT_KEY = "boot:stamp";

/**
 * تُنفَّذ مرة واحدة في كل نسخة عاملة. الحالة الشائعة — قاعدة مهيأة أصلاً —
 * تكلّف استعلاماً واحداً يقرأ البصمة، بدل عشر رحلات تتحقق من كل جدول.
 * وهذا يقع على أول طلب في كل نسخة عاملة جديدة، لا مرة واحدة في عمر المنصة،
 * فكان أثقل ما في فتح التطبيق البارد.
 */
export function ensureSchema(): Promise<void> {
  bootPromise ??= (async () => {
    try {
      const stamp = await db.setting.findUnique({ where: { key: BOOT_KEY } }).catch(() => null);
      if (stamp?.value === BOOT_STAMP) return;

      const applied = await applyMigrations();
      if (applied.length) console.log("applied migrations:", applied.join(", "));
      const cohortId = await ensureCohort();
      await ensureProgramData(cohortId);
      await db.setting.upsert({ where: { key: BOOT_KEY }, update: { value: BOOT_STAMP }, create: { key: BOOT_KEY, value: BOOT_STAMP } });
    } catch (e) {
      bootPromise = null;
      console.error("schema boot failed:", (e as Error).message);
    }
  })();
  return bootPromise;
}
