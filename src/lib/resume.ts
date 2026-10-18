import { db, isWorkers } from "./db";
import { parsePauseLog, planResume, referenceSaturday, type PauseEntry, type ShiftItem } from "./pause";

/**
 * ما يُقرأ ويُكتب عند استئناف دفعة. الحساب نقيٌّ في `pause.ts`، وهنا القاعدة:
 * تُقرأ المعاينةُ في صفحة الدفعات والاستئنافُ نفسه من الدالة نفسها، فما يراه
 * المدير قبل الضغط هو ما يُزاح بعده.
 */

type PausedCohort = { id: string; startDate: string; pausedAt: Date };

/** صفوف الدفعة التي قد تُزاح، والسبت المرجعي للإزاحة */
export async function loadResumeInputs(c: PausedCohort) {
  const at = c.pausedAt;
  const [weeks, assignments, extensions, reminders] = await Promise.all([
    db.programWeek.findMany({ where: { cohortId: c.id }, select: { id: true, number: true, gregorian: true }, orderBy: { number: "asc" } }),
    db.assignment.findMany({ where: { cohortId: c.id, dueAt: { gte: at } }, select: { id: true, title: true, dueAt: true }, orderBy: { dueAt: "asc" } }),
    // المعلّق يُزاح كالمقبول: إن قُبل بعد الاستئناف فبموعده الذي يقابل ما طُلب
    db.excuseRequest.findMany({
      where: { kind: "EXTENSION", status: { not: "REJECTED" }, untilAt: { gte: at }, user: { cohortId: c.id } },
      select: { id: true, untilAt: true },
    }),
    db.reminder.findMany({ where: { cohortId: c.id, sentAt: null, sendAt: { gte: at } }, select: { id: true, title: true, sendAt: true }, orderBy: { sendAt: "asc" } }),
  ]);
  return { weeks, assignments, extensions, reminders, ref: referenceSaturday(weeks, at) };
}

/** بنود الإزاحة لدفعةٍ موقوفة بإزاحةٍ بعينها */
export async function resumeItems(c: PausedCohort, shiftDays: number): Promise<{ items: ShiftItem[]; ref: string; weeks: { number: number; gregorian: string }[] }> {
  const inputs = await loadResumeInputs(c);
  return { items: planResume({ at: c.pausedAt, shiftDays, cohort: c, ...inputs }), ref: inputs.ref, weeks: inputs.weeks };
}

/**
 * ما يُكتب في الطلب الواحد. D1 بلا معاملات، والعامل يسقط عند خمسين طلباً فرعياً
 * وكل كتابةٍ طلبٌ مستقل — فتُكتب الإزاحة دفعاتٍ، ويُحفظ الباقي في السجل قبل الكتابة
 * فيُكمله «أكمل الإزاحة» إن انقطع الطلب. والقيم مطلقة لا فروق: إعادة كتابة بندٍ
 * كُتب لا تُزيحه مرة ثانية.
 */
const SHIFT_BUDGET = 30;

function writeOf(i: ShiftItem) {
  switch (i.m) {
    case "week":
      return db.programWeek.updateMany({ where: { id: i.id }, data: { gregorian: i.to, hijri: i.hijri } });
    case "start":
      return db.cohort.updateMany({ where: { id: i.id }, data: { startDate: i.to } });
    case "assignment":
      return db.assignment.updateMany({ where: { id: i.id }, data: { dueAt: new Date(i.to) } });
    case "extension":
      return db.excuseRequest.updateMany({ where: { id: i.id }, data: { untilAt: new Date(i.to) } });
    case "reminder":
      // ما أُرسل في أثناء ذلك لا يُمسّ
      return db.reminder.updateMany({ where: { id: i.id, sentAt: null }, data: { sendAt: new Date(i.to) } });
  }
}

/** يكتب دفعةً من البنود ويردّ ما بقي منها */
export async function applyShift(items: ShiftItem[]): Promise<ShiftItem[]> {
  const take = isWorkers ? SHIFT_BUDGET : items.length;
  const now = items.slice(0, take);
  if (now.length) await db.$transaction(now.map(writeOf));
  return items.slice(take);
}

/** يحفظ ما بقي من إزاحة آخر إيقافٍ في السجل، أو يمحوه إن اكتمل */
export async function savePending(cohortId: string, log: PauseEntry[], pending: ShiftItem[]): Promise<void> {
  const last = log[log.length - 1];
  if (!last) return;
  const next = [...log.slice(0, -1), { ...last, pending: pending.length ? pending : undefined }];
  await db.cohort.update({ where: { id: cohortId }, data: { pauses: JSON.stringify(next) } });
}

/** آخر إيقافٍ لم تكتمل إزاحته، إن وُجد */
export function unfinished(json: string): { log: PauseEntry[]; pending: ShiftItem[] } | null {
  const log = parsePauseLog(json);
  const pending = log[log.length - 1]?.pending;
  return pending?.length ? { log, pending } : null;
}
