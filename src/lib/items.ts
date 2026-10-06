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
