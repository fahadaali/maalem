import { PageHeader, Card } from "@/components/ui";
import { SCHEDULE_NOTE, WEEKS } from "@/lib/program";
import { currentWeekNumber, formatGregorian, keyToDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "الجدول الزمني" };

export default function SchedulePage() {
  const cur = currentWeekNumber();
  return (
    <>
      <PageHeader eyebrow="ثالثاً" title="الجدول الزمني الأسبوعي" subtitle={SCHEDULE_NOTE} />
      <div className="space-y-3">
        {WEEKS.map((w) => (
          <Card key={w.number} className={cn(w.number === cur && "border-ink")}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
              <h2 className="text-lg">الأسبوع {w.label}</h2>
              <span className="text-sm text-muted">{w.hijri} · {formatGregorian(keyToDate(w.gregorian))}</span>
              {w.number === cur && <span className="badge badge-ink">الأسبوع الحالي</span>}
              <span className="badge badge-soft">{w.competency}</span>
            </div>
            <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-xs text-muted">اللقاء الحضوري (ساعتان)</dt><dd>{w.session}</dd></div>
              <div><dt className="text-xs text-muted">حلقة النقاش عن بُعد (ساعة)</dt><dd>{w.circle}</dd></div>
              <div><dt className="text-xs text-muted">الورد القرائي</dt><dd>{w.reading}</dd></div>
              <div><dt className="text-xs text-muted">المهمة الأسبوعية والتسليم</dt><dd>{w.task}</dd></div>
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
