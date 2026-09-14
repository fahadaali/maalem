import Link from "@/components/Link";
import { requireParticipantView } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import WeekCard from "@/components/WeekCard";
import { getWeeks, resolveCurrentWeek } from "@/lib/weeks";
import { buildWeekStates } from "@/lib/week-state";
import { listAttachments } from "@/lib/attachments";
import { activeCohort } from "@/lib/cohort";
import { SCHEDULE_NOTE } from "@/lib/program";
import { cn } from "@/lib/utils";

export const metadata = { title: "بطاقات الأسابيع" };

/** اسم الأسبوع في شريط التنقّل: مختصرٌ يسع الشريط على الجوال */
function chip(n: number): string {
  return n === 0 ? "الافتتاحي" : n === 13 ? "الختامي" : n === 14 ? "احتياطي" : String(n);
}

export default async function WeekCardsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireParticipantView();
  const sp = await searchParams;
  const weeks = await getWeeks();
  const now = new Date();
  const cur = resolveCurrentWeek(weeks, now);

  const parsed = Number(sp.week);
  const asked = sp.week != null && Number.isInteger(parsed) ? parsed : Math.max(0, Math.min(cur, 14));
  const week = weeks.find((w) => w.number === asked) ?? weeks[0];

  const [cohort, states, files] = await Promise.all([
    activeCohort(),
    buildWeekStates(user.id, weeks, now),
    week?.id ? listAttachments({ kind: "WEEKCARD", refId: week.id }) : [],
  ]);

  // الأسابيع القادمة لا حالة لها: لم تبدأ بعد فلا ينقص المشارك منها شيء
  const state = week && week.number <= cur ? states.get(week.number) : undefined;
  const index = weeks.findIndex((w) => w.number === week?.number);
  const prev = index > 0 ? weeks[index - 1] : undefined;
  const next = index >= 0 && index < weeks.length - 1 ? weeks[index + 1] : undefined;

  return (
    <>
      <PageHeader
        title="بطاقات الأسابيع"
        subtitle="كل أسبوع في بطاقة واحدة: ما يُطلب منك، وفي أي يوم، وما تُسلّمه في نهايته."
      />

      <div className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
        {weeks.map((w) => (
          <Link
            key={w.number}
            href={`/app/week?week=${w.number}`}
            className={cn("badge shrink-0", w.number === week?.number && "badge-ink", w.number === cur && w.number !== week?.number && "border-ink")}
          >
            {chip(w.number)}
          </Link>
        ))}
      </div>

      {week && (
        <WeekCard
          week={week}
          total={13}
          cohortName={cohort?.name}
          state={state}
          current={week.number === cur}
          cardUrl={files[0]?.url}
        />
      )}

      <nav className="flex justify-between gap-2 mt-4">
        {prev ? (
          <Link href={`/app/week?week=${prev.number}`} className="btn btn-sm btn-secondary">الأسبوع السابق</Link>
        ) : (
          <span />
        )}
        {next && <Link href={`/app/week?week=${next.number}`} className="btn btn-sm btn-secondary">الأسبوع التالي</Link>}
      </nav>

      <p className="text-sm text-muted mt-6">{SCHEDULE_NOTE}</p>
    </>
  );
}
