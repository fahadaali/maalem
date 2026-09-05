import Link from "next/link";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { ACTIVE_WEEKS, currentWeekNumber, formatShort, reportDueDate } from "@/lib/dates";

export const metadata = { title: "التقارير الأسبوعية" };

export default async function ReportsPage() {
  const user = await requireParticipantView();
  const reports = await db.weeklyReport.findMany({ where: { userId: user.id } });
  const byWeek = new Map(reports.map((r) => [r.week, r]));
  const cur = currentWeekNumber();

  return (
    <>
      <PageHeader title="التقارير الأسبوعية" subtitle="تقرير رقمي بقالب موحد يُسلَّم كل خميس قبل الساعة العاشرة مساءً (ملحق 1)." />
      <div className="space-y-2">
        {ACTIVE_WEEKS.map((w) => {
          const r = byWeek.get(w.number);
          const future = w.number > cur;
          return (
            <Link key={w.number} href={`/app/reports/${w.number}`} className="card flex items-center justify-between gap-3 hover:bg-paper-2">
              <div className="min-w-0">
                <div className="font-medium">الأسبوع {w.label}</div>
                <div className="text-xs text-muted truncate">{w.task} · موعد التسليم {formatShort(reportDueDate(w.number))}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {r ? <Badge tone="ink">مسلّم</Badge> : future ? <Badge tone="soft">قادم</Badge> : <Badge>لم يُسلَّم</Badge>}
                {r?.feedback && <Badge>تغذية راجعة</Badge>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
