import { db } from "./db";
import { notifyAdmins } from "./notify";
import { RETURN_KINDS, type ReturnKind } from "./returns";

/**
 * إدخالات المشارك كما يراها مدير المشروع في «الملف»: أين تقع، وكيف يُفتح سجلٌّ
 * أُرجع، وما يُصفَّر حين يعيده صاحبه.
 */

/** تبويبات ملف المشارك عند المدير */
export const FILE_TABS = {
  overview: "نظرة عامة",
  work: "المهام والتقارير",
  reading: "القراءة والخطة",
  field: "الميدان والقيادة والمشروع",
  quizzes: "الاختبارات والحضور",
  journal: "اليوميات",
  log: "السجل والحساب",
} as const;

export type FileTab = keyof typeof FILE_TABS;

export function isFileTab(v: string | undefined): v is FileTab {
  return !!v && Object.prototype.hasOwnProperty.call(FILE_TABS, v);
}

/** تبويب كل نوعٍ من الإدخال في الملف */
export const TAB_OF: Record<ReturnKind, FileTab> = {
  SUBMISSION: "work",
  WEEKLY_REPORT: "work",
  READING_CARD: "reading",
  LEARNING_PLAN: "reading",
  FIELD_LOG: "field",
  LEADERSHIP: "field",
  PROJECT: "field",
};

/** مرساة العنصر في الملف — تُقصد من الإشعارات ومن «ما عليه الآن» */
export function itemAnchor(kind: string, id: string): string {
  return `i-${kind.toLowerCase()}-${id}`;
}

/** رابط العنصر في ملف صاحبه عند المدير */
export function fileHref(userId: string, kind: ReturnKind, id: string): string {
  return `/admin/participants/${userId}?tab=${TAB_OF[kind]}#${itemAnchor(kind, id)}`;
}

/** الإرجاع المفتوح على سجلٍّ بعينه */
export async function findOpenReturn(kind: ReturnKind, recordId: string) {
  return db.itemReturn.findFirst({ where: { kind, recordId, resolvedAt: null } });
}

/**
 * أعاد صاحبُ السجل تقديمَه بعد إرجاع: يُغلق الإرجاع، وتُصفَّر أختام المراجعة
 * فيعود السجل إلى طابور مراجِعه — التسليم إلى «غير مقيّم»، والمعايشة إلى «بانتظار
 * الاعتماد» — ويُشعَر مدير المشروع برابطٍ إلى العنصر في ملف صاحبه.
 *
 * لا يفعل شيئاً إن لم يكن على السجل إرجاعٌ مفتوح: الحفظ العادي يبقى كما كان.
 */
export async function markResubmitted(kind: ReturnKind, recordId: string, user: { id: string; name: string }): Promise<boolean> {
  const open = await findOpenReturn(kind, recordId);
  if (!open) return false;
  await db.itemReturn.updateMany({ where: { kind, recordId, resolvedAt: null }, data: { resolvedAt: new Date(), resolution: "RESUBMITTED" } });
  await clearReview(kind, recordId);
  await notifyAdmins({
    title: `أعاد ${user.name} تقديم ${RETURN_KINDS[kind]}`,
    body: `بعد إرجاعه بملاحظة: ${open.note.slice(0, 100)}`,
    url: fileHref(user.id, kind, recordId),
  });
  return true;
}

/** أختام المراجعة التي تُصفَّر عند إعادة التقديم، فيعود السجل إلى مراجِعه */
async function clearReview(kind: ReturnKind, id: string): Promise<void> {
  switch (kind) {
    case "SUBMISSION":
      await db.submission.updateMany({ where: { id }, data: { gradedAt: null } });
      return;
    case "WEEKLY_REPORT":
      await db.weeklyReport.updateMany({ where: { id }, data: { reviewedAt: null } });
      return;
    case "READING_CARD":
      await db.readingCard.updateMany({ where: { id }, data: { reviewedAt: null } });
      return;
    case "LEARNING_PLAN":
      await db.learningPlan.updateMany({ where: { id }, data: { reviewedAt: null } });
      return;
    case "FIELD_LOG":
      await db.fieldLog.updateMany({ where: { id }, data: { approvedAt: null, approvedBy: null } });
      return;
    case "LEADERSHIP":
    case "PROJECT":
      return;
  }
}

/**
 * يُغلق إرجاعات سجلاتٍ حُذفت — بالتراجع أو بحذف صاحبها أو بحذف المهمة — فلا
 * يبقى بندٌ «مُرجَع» في «مهامي» لسجلٍّ لم يعد موجوداً.
 */
export async function closeReturns(kind: ReturnKind, ids: string[], resolution: "DELETED" | "CANCELLED" = "DELETED"): Promise<void> {
  if (ids.length === 0) return;
  await db.itemReturn.updateMany({ where: { kind, recordId: { in: ids }, resolvedAt: null }, data: { resolvedAt: new Date(), resolution } });
}

/** الإرجاعات المفتوحة على مجموعة سجلات من نوعٍ واحد — لشارة «مُرجَع» في صفحات المراجعة */
export async function openReturnsOf(kind: ReturnKind, ids: string[]): Promise<Map<string, { note: string; returnedAt: Date }>> {
  if (ids.length === 0) return new Map();
  const rows = await db.itemReturn.findMany({ where: { kind, recordId: { in: ids }, resolvedAt: null }, select: { recordId: true, note: true, returnedAt: true } });
  return new Map(rows.map((r) => [r.recordId, { note: r.note, returnedAt: r.returnedAt }]));
}

// ——— سجلّ أنواع الإدخال: صاحبه وعنوانه ورابطه عند المشارك وحقول تعديله ———

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "url";
  required?: boolean;
  /** لحقل الأرقام: خطوة الزيادة (نصف ساعة للمعايشة) */
  step?: string;
  rows?: number;
};

/** حقول التعديل لكل نوع، يرسمها ملف المشارك ويقرؤها `saveItemEdit` — فلا يفترق النموذج عن الحفظ */
export const ITEM_FIELDS: Record<ReturnKind, FieldDef[]> = {
  READING_CARD: [
    { name: "date", label: "التاريخ", type: "date", required: true },
    { name: "book", label: "الكتاب", type: "text", required: true },
    { name: "fromPage", label: "من صفحة", type: "number", required: true },
    { name: "toPage", label: "إلى صفحة", type: "number", required: true },
    { name: "benefit", label: "أهم فائدة", type: "textarea", required: true, rows: 3 },
    { name: "question", label: "سؤال للحلقة", type: "text" },
  ],
  WEEKLY_REPORT: [
    { name: "reading", label: "الورد القرائي المنجز", type: "textarea", rows: 2 },
    { name: "benefits", label: "أبرز الفوائد", type: "textarea", rows: 3 },
    { name: "fieldNote", label: "المعايشة الميدانية", type: "textarea", rows: 2 },
    { name: "quizResult", label: "نتيجة الاختبار", type: "text" },
    { name: "application", label: "تطبيق في الميدان", type: "textarea", rows: 2 },
    { name: "difficulty", label: "صعوبة تحتاج دعماً", type: "textarea", rows: 2 },
  ],
  SUBMISSION: [
    { name: "content", label: "وصف ما أنجزه", type: "textarea", required: true, rows: 5 },
    { name: "link", label: "الرابط", type: "url" },
  ],
  LEARNING_PLAN: [
    { name: "goals", label: "أهداف الخطة الفصلية", type: "textarea", required: true, rows: 4 },
    { name: "weeklyPlan", label: "الخطة الأسبوعية", type: "textarea", rows: 4 },
    { name: "memorization", label: "خطة مراجعة المحفوظ", type: "textarea", rows: 3 },
  ],
  FIELD_LOG: [
    { name: "date", label: "التاريخ", type: "date", required: true },
    { name: "hours", label: "الساعات", type: "number", required: true, step: "0.5" },
    { name: "mentorName", label: "المشرف المرافق / المجموعة", type: "text", required: true },
    { name: "note", label: "الملاحظة", type: "textarea", required: true, rows: 3 },
  ],
  LEADERSHIP: [
    { name: "title", label: "عنوان النشاط", type: "text", required: true },
    { name: "date", label: "التاريخ", type: "date", required: true },
    { name: "report", label: "تقرير النشاط", type: "textarea", rows: 4 },
  ],
  PROJECT: [
    { name: "topic", label: "الموضوع", type: "text", required: true },
    { name: "problem", label: "المشكلة أو الفرصة", type: "textarea", rows: 3 },
    { name: "draftLink", label: "رابط المسودة", type: "url" },
    { name: "finalLink", label: "رابط النسخة النهائية", type: "url" },
  ],
};

export type ItemOwner = {
  userId: string;
  /** وصف العنصر في الإشعار ورسالة النجاح */
  title: string;
  /** صفحته عند المشارك */
  href: string;
  /** ما يُحسب منه موعده الأصلي */
  due: { assignment?: { id: string; dueAt: Date }; week?: number; date?: Date };
  /** سببٌ يمنع إرجاعه، إن وُجد */
  unreturnable?: string;
};

/** صاحب السجل ووصفه — يُتحقق منه قبل أي إرجاع أو تعديل، فلا يُمسّ سجلٌ بمعرّف مصنوع */
export async function itemOwner(kind: ReturnKind, id: string): Promise<ItemOwner | null> {
  switch (kind) {
    case "SUBMISSION": {
      const r = await db.submission.findUnique({ where: { id }, select: { userId: true, assignment: { select: { id: true, title: true, dueAt: true } } } });
      return r && { userId: r.userId, title: `تسليم «${r.assignment.title}»`, href: `/app/tasks/${r.assignment.id}`, due: { assignment: r.assignment } };
    }
    case "WEEKLY_REPORT": {
      const r = await db.weeklyReport.findUnique({ where: { id }, select: { userId: true, week: true } });
      return r && { userId: r.userId, title: `تقرير الأسبوع ${r.week}`, href: `/app/reports/${r.week}`, due: { week: r.week } };
    }
    case "READING_CARD": {
      const r = await db.readingCard.findUnique({ where: { id }, select: { userId: true, book: true, fromPage: true, toPage: true, date: true } });
      return r && { userId: r.userId, title: `بطاقة القراءة «${r.book}» ص ${r.fromPage}–${r.toPage}`, href: `/app/reading?edit=${id}#form`, due: { date: r.date } };
    }
    case "LEARNING_PLAN": {
      const r = await db.learningPlan.findUnique({ where: { id }, select: { userId: true } });
      return r && { userId: r.userId, title: "خطة التعلم الشخصية", href: "/app/plan", due: {} };
    }
    case "FIELD_LOG": {
      const r = await db.fieldLog.findUnique({ where: { id }, select: { userId: true, hours: true, date: true } });
      return r && { userId: r.userId, title: `سجل المعايشة (${r.hours} ساعة)`, href: `/app/field?edit=${id}#form`, due: { date: r.date } };
    }
    case "LEADERSHIP": {
      const r = await db.leadershipActivity.findUnique({ where: { id }, select: { userId: true, title: true } });
      return r && { userId: r.userId, title: `النشاط القيادي «${r.title}»`, href: `/app/leadership#a-${id}`, due: {} };
    }
    case "PROJECT": {
      const r = await db.graduationProject.findUnique({ where: { id }, select: { userId: true, topic: true, status: true } });
      return (
        r && {
          userId: r.userId,
          title: `مشروع التخرج «${r.topic}»`,
          href: "/app/project",
          due: {},
          // المحكَّم لا يُرجَع: الإرجاع يفتح التعديل، وتعديل ما حُكِّم يُبطل التحكيم
          unreturnable: r.status === "JUDGED" ? "حُكِّم المشروع فلا يُرجَع — أعد فتحه من صفحة المشاريع أولاً" : undefined,
        }
      );
    }
  }
}

/** قيم الحقول للنموذج: التاريخ مفتاحاً «YYYY-MM-DD» والأرقام نصوصاً */
export function fieldValue(v: unknown, def: FieldDef, dateKey: (d: Date) => string): string {
  if (v == null) return "";
  if (def.type === "date" && v instanceof Date) return dateKey(v);
  return String(v);
}
