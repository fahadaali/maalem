import { db, isWorkers } from "./db";
import { MIGRATIONS } from "./schema-sql";
import { log, logError, reason } from "./log";
import { BUDGET, PROGRAM, WEEKS, BOOKS, CHARTER, CONTINUOUS_ASSESSMENT, PROJECT_RUBRIC, COMPLETION_LEVELS, COMPETENCIES } from "./program";
import { splitTasks } from "./report";

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

/** عبارات ملف ترحيلٍ مفردةً: تُحذف أسطر التعليق ثم تُشقّ على فاصلةٍ منقوطة في آخر السطر */
function statementsOf(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

/** إعادةُ بناء جدولٍ: لا تُنفَّذ في طلب مستخدم بحال، فD1 بلا معاملات */
const DESTRUCTIVE = /\bDROP\s+TABLE\b|\bRENAME\s+TO\b/i;

export type MigrationPlan = {
  /** تُسجَّل مطبَّقةً بلا تنفيذ */
  baseline: string[];
  /** تُنفَّذ ثم تُسجَّل */
  pending: { name: string; statements: string[] }[];
  /** مجموع ما سيُنفَّذ — به يُقاس الإقلاع على سقف الطلبات الفرعية */
  statements: number;
  /** أولُ ترحيلٍ معلَّقٍ يعيد بناء جدول، أو null */
  destructive: string | null;
};

/**
 * ما الذي يلزم تطبيقه؟ قارئةٌ محضة: استعلامان في الحالة المعتادة (إنشاء جدول
 * السجل إن غاب، ثم قراءة أسمائه)، فيُعرف حجم العمل **قبل** الشروع فيه.
 *
 * وشقُّها عن التنفيذ هو ما يتيح الرفض: 158 عبارة لا يمكن أن تكتمل في خمسين
 * طلباً فرعياً، فمعرفةُ العدد سلفاً تمنع بدءاً يموت في المنتصف.
 */
export async function migrationPlan(): Promise<MigrationPlan> {
  // بلا AUTOINCREMENT: إنشاؤه يستلزم جدول sqlite_sequence الذي يمنعه D1 من داخل التطبيق
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const applied = new Set((await db.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM d1_migrations`)).map((r) => r.name));
  /**
   * قاعدة أُنشئت بـ prisma db push (المسار المحلي في README): جداولها كاملة على
   * آخر صورة للمخطط، لكن لا سجل لها في d1_migrations. تنفيذ الترحيلات عليها
   * يفشل من أول تعليمة — بل قد يُتلفها لأن بعضها يعيد بناء الجداول — فكان الإقلاع
   * يفشل في كل طلب ولا تُبذر بيانات الخطة أبداً. فتُسجَّل الترحيلات كلها كمطبَّقة
   * دون تنفيذ، بشرط وجود آخر ما أضافته الترحيلات فعلاً.
   */
  let baseline: string[] = [];
  if (applied.size === 0 && (await schemaReady()) && (await tableExists(BASELINE_SENTINEL.table))) {
    // أسماء الملفات مرقَّمة بأصفار بادئة، فمقارنة النصوص ترتيبٌ صحيح
    baseline = MIGRATIONS.filter((m) => m.name <= BASELINE_SENTINEL.through).map((m) => m.name);
    for (const name of baseline) applied.add(name);
  }
  const pending = MIGRATIONS.filter((m) => !applied.has(m.name)).map((m) => ({ name: m.name, statements: statementsOf(m.sql) }));
  return {
    baseline,
    pending,
    statements: pending.reduce((n, m) => n + m.statements.length, 0),
    destructive: pending.find((m) => m.statements.some((st) => DESTRUCTIVE.test(st)))?.name ?? null,
  };
}

/**
 * تسجيل ترحيلٍ مطبَّقاً. `INSERT OR IGNORE` لا `INSERT`: نسختان تُقلعان معاً لا
 * تتسابقان على قيد `UNIQUE`، فتمرّ الثانية صامتةً بدل أن تُسقط الإقلاع كله
 * بخطأٍ نتيجتُه محقَّقةٌ أصلاً.
 */
async function register(name: string): Promise<void> {
  await db.$executeRawUnsafe(`INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${name.replace(/'/g, "''")}')`);
}

/**
 * عبارةٌ واحدة. ما تعذّر منها يُسجَّل باسم ترحيله ونصّه ثم يُرمى: فموضعُ التوقف
 * معلومٌ في السجل، والترحيلُ لا يُسجَّل مطبَّقاً وقد توقف في منتصفه.
 */
async function runStatement(migration: string, st: string): Promise<void> {
  try {
    // بعض تعليمات PRAGMA لا تقبلها D1 من داخل التطبيق، وهي إرشادية هنا
    if (/^PRAGMA\s/i.test(st)) {
      await db.$executeRawUnsafe(st).catch(() => {});
      return;
    }
    /**
     * عمودٌ أضافه prisma db push قبل أن يجري ترحيله — وهو المسار المحلي في
     * README — ليس خطأً يوقف الإقلاع: المطلوب حاصل. ولولا التجاوز لفشل الإقلاع
     * في كل طلب ولم تُبذر بيانات الخطة أبداً.
     */
    if (/^ALTER\s+TABLE[\s\S]+ADD\s+COLUMN/i.test(st)) {
      await db.$executeRawUnsafe(st).catch((e: unknown) => {
        if (!/duplicate column/i.test(reason(e))) throw e;
      });
      return;
    }
    /**
     * وكذلك جدولٌ أو فهرسٌ أنشأه prisma db push قبل ترحيله: «موجود سلفاً» ليس
     * خطأً يوقف الإقلاع، فالمطلوب حاصل. ولولا التجاوز لفشل الإقلاع في كل طلب
     * ولم تُبذر بيانات الخطة أبداً — كما وقع فعلاً مع أول ترحيلٍ ينشئ جدولاً
     * بعد اعتماد هذا المسار في README.
     */
    if (/^CREATE\s+(TABLE|(UNIQUE\s+)?INDEX)/i.test(st)) {
      await db.$executeRawUnsafe(st).catch((e: unknown) => {
        if (!/already exists/i.test(reason(e))) throw e;
      });
      return;
    }
    await db.$executeRawUnsafe(st);
  } catch (e) {
    logError("boot.statement-failed", { migration, statement: st.slice(0, 200), reason: reason(e) });
    throw e;
  }
}

/** ينفّذ خطةً قُرئت سلفاً، ويسجّلها في جدول d1_migrations ليتوافق مع wrangler */
export async function applyPending(plan: MigrationPlan): Promise<string[]> {
  for (const name of plan.baseline) await register(name);
  if (plan.baseline.length) log("boot.baselined", { count: plan.baseline.length });
  const done: string[] = [];
  for (const m of plan.pending) {
    for (const st of m.statements) await runStatement(m.name, st);
    await register(m.name);
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
  }
  // وإكمالُ صفّ المعايشة للدفعات المبذورة قبل إضافته صار ترحيلاً — 0015 — يجري
  // مرةً واحدة أبداً وقت النشر، بعد أن كان عشر رحلاتٍ متسلسلة في كل إقلاع.
  /**
   * مهام الأسبوع صفوفاً: كان الأسبوع نصّاً واحداً تُفصل مهامه بـ « + »، فصار لكل
   * مهمة صفٌّ يرصد عليه المشارك إنجازه. وSQL لا يشقّ النصوص، فالاشتقاق هنا حيث
   * تُقرأ الصفوف — وبه تلحق الدفعات المبذورة قبل هذا الجدول بمهامّها في أول طلب
   * بعد النشر، بلا تدخل يدوي. والحارس على الجدول كله لا على كل أسبوع: مديرٌ أفرغ
   * مهامّ أسبوعٍ عمداً لا تُبعث له بالترحيل التالي.
   */
  if ((await db.weekTask.count({ where: { cohortId } })) === 0) {
    const rows = await db.programWeek.findMany({ where: { cohortId }, select: { number: true, task: true } });
    const data = rows.flatMap((w) => splitTasks(w.task).map((title, order) => ({ cohortId, week: w.number, order, title })));
    if (data.length) await db.weekTask.createMany({ data });
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

/**
 * بصمةُ الحالة المتوقَّعة، مشقوقةً شِقَّين: نسخةُ المخطط `m` ونسخةُ البذر `s`.
 *
 * وكانت واحدةً تخلطهما، فكلُّ ملف `.sql` جديد — وهو تغيُّرٌ في المخطط وحده —
 * يُبطلها فيُعاد فحص البذر كلِّه: تسعُ رحلاتٍ إلى القاعدة لا تُغيّر شيئاً، في
 * أول طلبٍ يصل كلَّ نسخةٍ عاملة بعد النشر.
 */
const SCHEMA_MARK = `m${MIGRATIONS.length}`;
/** تُرفع بيدٍ حين يتغيّر محتوى `ensureProgramData` فيلزم فحصه ثانية */
const SEED_VERSION = 1;
const SEED_MARK = `s${SEED_VERSION}`;
const BOOT_STAMP = `${SCHEMA_MARK}.${SEED_MARK}`;
const BOOT_KEY = "boot:stamp";

/**
 * حالةُ الإقلاع **بياناتٌ فقط**: بولياناتٌ وأرقام، ولا وعد في نطاق الوحدة بحال.
 *
 * فقد كان هنا `bootPromise` مشتركاً بين الطلبات، وWorkers يمنع انتظار إدخال/إخراج
 * أُنشئ في سياق طلبٍ آخر فيرمي `Cannot perform I/O on behalf of a different
 * request` — وهو ما يقع حين يطول الإقلاع ويتزاحم الطلب، أي بعد النشر بالضبط.
 * ولأنها بياناتٌ صرفة، فتزاحمُ عشرة طلبات يعني أن كلاً منها يُقلع **في سياقه هو**
 * ولا شيء يعبر الحدود. وهو مقبولٌ لأن الحالة المستقرة استعلامٌ واحد، ولأن كل
 * كتابةٍ هنا متكافئة (`INSERT OR IGNORE` و`upsert` و`createMany` محروسةٌ بعدّ).
 */
let booted = false;
let retryAfter = 0;
let failures = 0;

/** تراجعٌ أُسّي يُصفَّر عند أول نجاح: بلا مهلةٍ كان كلُّ طلبٍ يُعيد المحاولة — عاصفة */
const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000, 900_000];

/**
 * سقفُ ما يُنفَّذ من عبارات في طلب مستخدم. أُخذ من حدّ الخطة المجانية — خمسون
 * طلباً فرعياً — بعد طرح ما يحتاجه الطلب نفسه من قراءاتٍ وكتابات.
 */
const RUNTIME_STATEMENT_BUDGET = 12;
/** مهلة الرفض: العلاج يدويٌّ، فلا معنى لإعادة المحاولة سريعاً */
const REFUSE_MS = 900_000;
export const MIGRATE_COMMAND = "npx wrangler d1 migrations apply maalem-db --remote";

/**
 * هل يتجاوز هذا القدرُ ما يُنفَّذ في طلبٍ واحد؟ يعيد سببَ المنع أو `null`.
 *
 * سقفُ الطلبات الفرعية قيدٌ على Workers وحده، فمحلياً لا حدّ. وأما هناك:
 * ترحيلٌ لا يمكن أن يكتمل يموت في منتصفه — وD1 بلا معاملات — فيترك القاعدة في
 * حالةٍ مسمومة تفشل أبداً. ونصفُ فرصةٍ لتخريب القاعدة عند كل نسخةٍ باردة أسوأ
 * من صفحةٍ تُخدَم منقوصةً وسطرٍ يقول ما العلاج.
 */
export function tooMuchForRequest(plan: MigrationPlan): string | null {
  if (!isWorkers) return null;
  if (plan.destructive) return `الترحيل ${plan.destructive} يعيد بناء جدول، ولا تُنفَّذ إعادةُ البناء في طلب`;
  if (plan.statements > RUNTIME_STATEMENT_BUDGET) return `${plan.statements} عبارة، والحدّ في الطلب الواحد ${RUNTIME_STATEMENT_BUDGET}`;
  return null;
}

/**
 * تُنفَّذ مرة واحدة في كل نسخة عاملة: تطبّق أي ترحيل جديد لم يُطبَّق بعد،
 * ثم تبذر بيانات الخطة. بهذا تصل التحديثات إلى قاعدة تعمل بلا تدخل يدوي.
 *
 * والحالة الشائعة — قاعدة مهيأة أصلاً — تكلّف استعلاماً واحداً يقرأ البصمة.
 * وهذا يقع على أول طلب في كل نسخة عاملة جديدة، لا مرة واحدة في عمر المنصة،
 * فكان أثقل ما في فتح التطبيق البارد.
 */
export async function ensureSchema(): Promise<void> {
  if (booted || Date.now() < retryAfter) return;
  try {
    // `catch` على القراءة وحدها: أول إقلاعٍ لقاعدةٍ فارغة لا جدول `Setting` فيه،
    // وهو حالُ البدء المشروع لا عطلاً — فيُقرأ كبصمةٍ غائبة ويمضي الإقلاع
    const stamp = (await db.setting.findUnique({ where: { key: BOOT_KEY } }).catch(() => null))?.value ?? "";
    if (stamp === BOOT_STAMP) {
      booted = true;
      failures = 0;
      return;
    }
    const [schemaMark, seedMark] = stamp.split(".");

    if (schemaMark !== SCHEMA_MARK) {
      const plan = await migrationPlan();
      // الرفض الصريح: تُخدَم الصفحة منقوصةً، ويقول سطرٌ واحدٌ ما العلاج
      const tooMuch = tooMuchForRequest(plan);
      if (tooMuch) {
        logError("boot.refuse", {
          why: tooMuch,
          statements: plan.statements,
          migrations: plan.pending.map((m) => m.name),
          remedy: MIGRATE_COMMAND,
        });
        retryAfter = Date.now() + REFUSE_MS;
        return;
      }
      const done = await applyPending(plan);
      if (done.length) log("boot.migrated", { migrations: done, statements: plan.statements });
    }

    if (seedMark !== SEED_MARK) {
      const cohortId = await ensureCohort();
      await ensureProgramData(cohortId);
    }

    await db.setting.upsert({ where: { key: BOOT_KEY }, update: { value: BOOT_STAMP }, create: { key: BOOT_KEY, value: BOOT_STAMP } });
    // النجاح يُسجَّل بعد كتابة البصمة وحدها: ما دونها إقلاعٌ لم يتمّ
    booted = true;
    failures = 0;
    log("boot.done", { stamp: BOOT_STAMP, from: stamp || "(none)" });
  } catch (e) {
    const wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
    failures += 1;
    retryAfter = Date.now() + wait;
    logError("boot.failed", { attempt: failures, retryInMs: wait, reason: reason(e) });
  }
}

/** حالةُ الإقلاع كما تراها هذه النسخة العاملة — تُقرأ من الذاكرة بلا استعلام */
export function bootState() {
  return { stamp: BOOT_STAMP, booted, failures, retryInMs: Math.max(0, retryAfter - Date.now()), migrations: MIGRATIONS.length };
}
