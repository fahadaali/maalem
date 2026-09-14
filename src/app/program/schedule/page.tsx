import { PageHeader } from "@/components/ui";
import WeekCard from "@/components/WeekCard";
import { SCHEDULE_NOTE } from "@/lib/program";
import { getWeeks, resolveCurrentWeek } from "@/lib/weeks";
import { activeCohort } from "@/lib/cohort";

export const metadata = { title: "الجدول الزمني" };

export default async function SchedulePage() {
  const [weeks, cohort] = await Promise.all([getWeeks(), activeCohort()]);
  const cur = resolveCurrentWeek(weeks);
  return (
    <>
      <PageHeader eyebrow="ثالثاً" title="الجدول الزمني الأسبوعي" subtitle={SCHEDULE_NOTE} />
      <div className="space-y-4">
        {weeks.map((w) => (
          // وثيقة البرنامج عامة: تُعرض البطاقة بمحتواها دون حالة مشاركٍ بعينه
          <WeekCard key={w.number} week={w} total={13} cohortName={cohort?.name} current={w.number === cur} />
        ))}
      </div>
    </>
  );
}
