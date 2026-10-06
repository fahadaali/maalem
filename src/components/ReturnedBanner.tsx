import { formatDateTime } from "@/lib/dates";
import { daysLate, overdueLabel } from "@/lib/obligations";
import { remaining } from "@/lib/week-state";

/**
 * شريطٌ على صفحة الإدخال الذي أرجعه مدير المشروع إلى صاحبه: ملاحظته، وعدّادٌ
 * بالموعد الأصلي لا بمهلة جديدة — فيبادر صاحبه إلى التعديل وإعادة التقديم.
 */
export default function ReturnedBanner({ note, by, due, now = new Date(), action = "عدّل ثم أعد التقديم من النموذج أدناه." }: { note: string; by: string; due?: Date | null; now?: Date; action?: string }) {
  const late = due ? due.getTime() < now.getTime() : false;
  return (
    <div role="alert" className="rounded-xl px-4 py-3 text-sm border-2 border-ink bg-paper-3 mb-4">
      <div className="font-medium">أُرجع إليك للتعديل</div>
      <div className="whitespace-pre-wrap mt-1">
        <span className="text-muted">ملاحظة {by}: </span>
        {note}
      </div>
      {due && (
        <div className="text-xs mt-2">
          {late ? `${overdueLabel(daysLate(due, now))} عن موعده الأصلي` : remaining(Math.ceil((due.getTime() - now.getTime()) / 86400000))}
          {" "}({formatDateTime(due)}). لا يُحتسب في درجتك حتى تعيده.
        </div>
      )}
      <div className="text-xs text-muted mt-1">{action}</div>
    </div>
  );
}
