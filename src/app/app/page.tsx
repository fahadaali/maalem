import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Progress, Stat, Badge } from "@/components/ui";
import { currentWeekNumber, dayName, formatHijri, formatGregorian, getWeek, reportDueDate, daysUntil, todayKey, weekdayIndex } from "@/lib/dates";
import { computeGrades } from "@/lib/grades";
import { PARTICIPANT_ROUTINE } from "@/lib/program";

export const metadata = { title: "الرئيسية" };

export default async function Dashboard() {
  const user = await requireRole("PARTICIPANT", "ADMIN");
  const now = new Date();
  const weekNo = currentWeekNumber(now);
  const week = getWeek(weekNo);
  const wd = weekdayIndex(now);
  const today = todayKey(now);

  const [grades, todayCard, report, unread, pendingQuizzes, openAssignments, activeAssignments] = await Promise.all([
    computeGrades(user.id),
    db.readingCard.findFirst({ where: { userId: user.id, date: { gte: new Date(`${today}T00:00:00+03:00`), lt: new Date(`${today}T23:59:59+03:00`) } } }),
    weekNo >= 0 && weekNo <= 12 ? db.weeklyReport.findUnique({ where: { userId_week: { userId: user.id, week: weekNo } } }) : null,
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.quiz.findMany({ where: { published: true, attempts: { none: { userId: user.id } } }, select: { id: true, title: true }, take: 3 }),
    db.assignment.findMany({ where: { dueAt: { gte: now }, submissions: { none: { userId: user.id } } }, orderBy: { dueAt: "asc" }, take: 3 }),
    db.assignment.count({ where: { dueAt: { gte: now } } }),
  ]);

  const routine = weekNo < 0 || weekNo > 13 ? undefined : PARTICIPANT_ROUTINE.find((r) => (wd === 6 && r.day === "السبت") || (wd >= 0 && wd <= 4 && r.day === "الأحد – الخميس") || (wd === 5 && r.day === "الجمعة"));
  const isReadingDay = wd >= 0 && wd <= 4;
  const due = weekNo >= 0 && weekNo <= 12 ? reportDueDate(weekNo) : null;

  return (
    <>
      <PageHeader
        eyebrow={`${dayName(now)} · ${formatHijri(now)} · ${formatGregorian(now)}`}
        title={`مرحباً ${user.name.split(" ")[0]}`}
        subtitle={
          weekNo < 0
            ? "البرنامج لم يبدأ بعد. هيّئ خطة التعلم الشخصية وراجع الجدول."
            : weekNo > 14
              ? "انتهى البرنامج. راجع ملف إنجازك ونتيجتك النهائية."
              : `الأسبوع ${week?.label} — ${week?.competency}`
        }
      />

      {/* مهمة اليوم */}
      <Card className="mb-4 border-ink">
        <div className="text-xs text-muted mb-1">مهمة اليوم</div>
        <div className="font-medium">{routine?.activity ?? (weekNo < 0 ? "هيّئ خطة التعلم الشخصية وخطة مراجعة المحفوظ قبل اللقاء الافتتاحي" : "راجع ملف إنجازك")}</div>
        {routine && <div className="text-sm text-muted mt-0.5">{routine.time} · المخرج: {routine.output}</div>}
        <div className="flex flex-wrap gap-2 mt-3">
          {weekNo < 0 && <Link href="/app/plan" className="btn btn-sm">خطة التعلم الشخصية</Link>}
          {isReadingDay && routine && (
            <Link href="/app/reading" className="btn btn-sm">
              {todayCard ? "بطاقة اليوم مسجلة ✓" : "سجّل بطاقة القراءة"}
            </Link>
          )}
          {wd === 2 && pendingQuizzes.length > 0 && (
            <Link href={`/app/quizzes/${pendingQuizzes[0].id}`} className="btn btn-sm btn-secondary">
              الاختبار التكويني
            </Link>
          )}
          {wd === 4 && weekNo >= 0 && weekNo <= 12 && (
            <Link href={`/app/reports/${weekNo}`} className="btn btn-sm btn-secondary">
              {report ? "التقرير مسلّم ✓" : "سلّم التقرير الأسبوعي"}
            </Link>
          )}
          {wd === 5 && routine && (
            <Link href="/app/reflection" className="btn btn-sm btn-secondary">اكتب تأمل الأسبوع</Link>
          )}
          {wd === 6 && routine && (
            <Link href="/program/schedule" className="btn btn-sm btn-secondary">محتوى لقاء اليوم</Link>
          )}
        </div>
      </Card>

      {/* هذا الأسبوع */}
      {week && weekNo <= 13 && (
        <Card className="mb-4" title={`الأسبوع ${week.label}`} action={<Link href="/program/schedule" className="text-xs text-muted underline">الجدول كاملاً</Link>}>
          <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-xs text-muted">اللقاء الحضوري (السبت)</dt><dd>{week.session}</dd></div>
            <div><dt className="text-xs text-muted">حلقة النقاش (الثلاثاء)</dt><dd>{week.circle}</dd></div>
            <div><dt className="text-xs text-muted">الورد القرائي</dt><dd>{week.reading}</dd></div>
            <div><dt className="text-xs text-muted">المهمة الأسبوعية</dt><dd>{week.task}</dd></div>
          </dl>
          {due && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={report ? "ink" : "default"}>{report ? "التقرير الأسبوعي مسلّم" : `تسليم التقرير: الخميس 10 مساءً (${daysUntil(due, now) >= 0 ? `بعد ${daysUntil(due, now)} يوم` : "فات الموعد"})`}</Badge>
              {unread > 0 && <Link href="/app/notifications" className="badge">{unread} إشعار جديد</Link>}
            </div>
          )}
        </Card>
      )}

      {/* ما ينتظرك */}
      {(openAssignments.length > 0 || pendingQuizzes.length > 0) && (
        <Card className="mb-4" title="بانتظارك">
          <ul className="divide-y divide-line text-sm">
            {openAssignments.map((a) => (
              <li key={a.id} className="py-2 flex justify-between gap-2">
                <Link href={`/app/tasks/${a.id}`} className="hover:underline">{a.title}</Link>
                <span className="text-muted text-xs whitespace-nowrap">{daysUntil(a.dueAt, now)} يوم</span>
              </li>
            ))}
            {pendingQuizzes.map((q) => (
              <li key={q.id} className="py-2 flex justify-between gap-2">
                <Link href={`/app/quizzes/${q.id}`} className="hover:underline">{q.title}</Link>
                <span className="text-muted text-xs">اختبار</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* التقدم */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="المجموع الحالي" value={`${grades.total}`} hint={`من 100 · ${grades.level}`} href="/app/portfolio" />
        <Stat label="بطاقات القراءة" value={grades.stats.cards} hint={`من ${grades.stats.expectedCards}`} href="/app/reading" />
        <Stat label="ساعات المعايشة" value={grades.stats.fieldHours} hint="من 12 معتمدة" href="/app/field" />
        <Stat label="المهام المسلّمة" value={`${grades.stats.submitted}/${grades.stats.assignments || activeAssignments}`} hint={`تم تقييم ${grades.stats.graded}`} href="/app/tasks" />
      </div>
      <Card title="التقييم المستمر (70)">
        <div className="space-y-3">
          <Progress label="الحضور والمشاركة (10)" value={grades.attendance} max={10} />
          <Progress label="الورد القرائي والحلقات (15)" value={grades.reading} max={15} />
          <Progress label="الاختبارات التكوينية (10)" value={grades.quizzes} max={10} />
          <Progress label="المهام والتقارير (20)" value={grades.tasks} max={20} />
          <Progress label="المعايشة الميدانية (10)" value={grades.field} max={10} />
          <Progress label="الدور القيادي (5)" value={grades.leadership} max={5} />
        </div>
      </Card>
    </>
  );
}
