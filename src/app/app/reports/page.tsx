import Link from "@/components/Link";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadParticipant } from "@/lib/participant-data";
import { returnedIds } from "@/lib/returns";
import { PageHeader, Badge } from "@/components/ui";
import { formatShort, reportDueFrom } from "@/lib/dates";
import { currentWeekNumber, getActiveWeeks } from "@/lib/weeks";

export const metadata = { title: "التقارير الأسبوعية" };

export default async function ReportsPage() {
  const user = await requireParticipantView();
  const [reports, rows] = await Promise.all([db.weeklyReport.findMany({ where: { userId: user.id } }), loadParticipant(user.id)]);
  const returned = returnedIds(rows?.returns ?? [], "WEEKLY_REPORT");
  const now = new Date();
  const byWeek = new Map(reports.map((r) => [r.week, r]));
  const cur = await currentWeekNumber();
  const activeWeeks = await getActiveWeeks();

  return (
    <>
      <PageHeader title="التقارير الأسبوعية" subtitle="تقرير رقمي بقالب موحد يُسلَّم كل خميس قبل الساعة العاشرة مساءً (ملحق 1)." />
      {/* السطر المقابل لما في صفحة المهام: الفرقُ مكتوبٌ على الصفحتين لا يُخمَّن */}
      <p className="text-sm text-muted -mt-2 mb-4">
        وهو غيرُ المهمة التطبيقية التي تُرفع وتُقيَّم من ستّ عشرة:{" "}
        <Link href="/app/tasks?type=tasks" className="underline hover:text-ink">المهام الأسبوعية في «مهامي»</Link>
      </p>
      <div className="space-y-2">
        {activeWeeks.map((w) => {
          const r = byWeek.get(w.number);
          const future = w.number > cur;
          const due = reportDueFrom(w.gregorian);
          return (
            <Link key={w.number} href={`/app/reports/${w.number}`} className="card flex items-center justify-between gap-3 hover:bg-paper-2">
              <div className="min-w-0">
                <div className="font-medium">الأسبوع {w.label}</div>
                {/* أسبوعٌ بلا مهام يبقى له تقرير، فلا يُترك «·» معلّقاً بلا نصّ قبله */}
                <div className="text-xs text-muted truncate">{w.task ? `${w.task} · ` : ""}موعد التسليم {formatShort(reportDueFrom(w.gregorian))}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {/* «لم يُسلَّم» كانت للمتأخر ولما لم يحن موعده معاً: الأسبوع الجاري قبل خميسه ليس متأخراً */}
                {r && returned.has(r.id) ? (
                  <Badge tone="ink">أُرجع إليك للتعديل</Badge>
                ) : r ? (
                  <Badge tone="ink">مسلّم</Badge>
                ) : future ? (
                  <Badge tone="soft">قادم</Badge>
                ) : due < now ? (
                  <Badge tone="ink">متأخر</Badge>
                ) : (
                  <Badge>مطلوب هذا الأسبوع</Badge>
                )}
                {r?.feedback && <Badge>تغذية راجعة</Badge>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
