import { formatDateTime } from "@/lib/dates";
import { daysLate, daysLeft, overdueLabel } from "@/lib/obligations";
import { remaining } from "@/lib/week-state";
import { cohortPause } from "@/lib/cohort";
import { isFrozen } from "@/lib/pause";

/**
 * شريطٌ على صفحة الإدخال الذي أرجعه مدير المشروع إلى صاحبه: ملاحظته، وعدّادٌ
 * بالموعد الأصلي لا بمهلة جديدة — فيبادر صاحبه إلى التعديل وإعادة التقديم.
 */
export default async function ReturnedBanner({ note, by, due, now = new Date(), action = "عدّل ثم أعد التقديم من النموذج أدناه." }: { note: string; by: string; due?: Date | null; now?: Date; action?: string }) {
  // أيام إيقاف الدفعة لا تُعدّ تأخيراً، وأثناءه يقف العدّاد
  const pause = await cohortPause();
  const frozen = isFrozen(due ?? null, pause);
  const late = due && !frozen ? due.getTime() < now.getTime() : false;
  return (
    <div role="alert" className="rounded-xl px-4 py-3 text-sm border-2 border-ink bg-paper-3 mb-4">
      <div className="font-medium">أُرجع إليك للتعديل</div>
      <div className="whitespace-pre-wrap mt-1">
        <span className="text-muted">ملاحظة {by}: </span>
        {note}
      </div>
      {due && (
        <div className="text-xs mt-2">
          {frozen ? "موقوف حتى الاستئناف" : late ? `${overdueLabel(daysLate(due, now, pause))} عن موعده الأصلي` : remaining(daysLeft(due, now))}
          {" "}({formatDateTime(due)}). لا يُحتسب في درجتك حتى تعيده.
        </div>
      )}
      <div className="text-xs text-muted mt-1">{action}</div>
    </div>
  );
}
