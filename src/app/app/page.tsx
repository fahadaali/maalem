import Link from "next/link";
import { Suspense } from "react";
import { Video } from "lucide-react";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import FormMessage from "@/components/FormMessage";
import { dayName, formatHijri, formatGregorian, daysUntil, todayKey, weekdayIndex } from "@/lib/dates";
import { currentWeekNumber, getWeekByNumber, reportDueDate } from "@/lib/weeks";
import ProgressSummary, { ProgressSummarySkeleton } from "@/components/ProgressSummary";
import { PARTICIPANT_ROUTINE } from "@/lib/program";
import { cohortWhere } from "@/lib/cohort";

export const metadata = { title: "الرئيسية" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const { err, ok: okMsg } = await searchParams;
  const user = await requireParticipantView();
  const now = new Date();
  const weekNo = await currentWeekNumber(now);
  const week = await getWeekByNumber(weekNo);
  const wd = weekdayIndex(now);
  const today = todayKey(now);

  const [todayCard, report, unread, pendingQuizzes, openAssignments, activeAssignments, me, diagnostics] = await Promise.all([
    db.readingCard.findFirst({ where: { userId: user.id, date: { gte: new Date(`${today}T00:00:00+03:00`), lt: new Date(`${today}T23:59:59+03:00`) } } }),
    weekNo >= 0 && weekNo <= 12 ? db.weeklyReport.findUnique({ where: { userId_week: { userId: user.id, week: weekNo } } }) : null,
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.quiz.findMany({ where: { published: true, attempts: { none: { userId: user.id } }, ...(await cohortWhere()) }, select: { id: true, title: true }, take: 3 }),
    db.assignment.findMany({ where: { dueAt: { gte: now }, submissions: { none: { userId: user.id } }, ...(await cohortWhere()) }, orderBy: { dueAt: "asc" }, take: 3 }),
    db.assignment.count({ where: { dueAt: { gte: now }, ...(await cohortWhere()) } }),
    db.user.findUnique({ where: { id: user.id }, select: { charterAcceptedAt: true } }),
    db.diagnostic.findMany({ where: { userId: user.id }, select: { stage: true } }),
  ]);
  const needsCharter = user.role === "PARTICIPANT" && !me?.charterAcceptedAt;
  const needsDiagnostic = user.role === "PARTICIPANT" && !diagnostics.some((d) => d.stage === "PRE");
  const needsPostDiagnostic = user.role === "PARTICIPANT" && weekNo >= 12 && diagnostics.some((d) => d.stage === "PRE") && !diagnostics.some((d) => d.stage === "POST");

  const routine = weekNo < 0 || weekNo > 13 ? undefined : PARTICIPANT_ROUTINE.find((r) => (wd === 6 && r.day === "السبت") || (wd >= 0 && wd <= 4 && r.day === "الأحد – الخميس") || (wd === 5 && r.day === "الجمعة"));
  const isReadingDay = wd >= 0 && wd <= 4;
  const due = weekNo >= 0 && weekNo <= 12 ? await reportDueDate(weekNo) : null;

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

      <FormMessage ok={okMsg} err={err} />

      {(needsCharter || needsDiagnostic || needsPostDiagnostic) && (
        <Card className="mb-4 border-ink">
          <div className="text-xs text-muted mb-1">مطلوب منك</div>
          <ul className="text-sm space-y-2">
            {needsCharter && (
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>توقيع ميثاق المشاركة — شرط لبدء البرنامج ومنح وثيقة الإتمام.</span>
                <Link href="/app/charter" className="btn btn-sm shrink-0">توقيع الميثاق</Link>
              </li>
            )}
            {needsDiagnostic && (
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>التقييم التشخيصي القبلي — يقيس مستواك قبل البرنامج ولا يدخل في درجاتك.</span>
                <Link href="/app/diagnostic" className="btn btn-sm btn-secondary shrink-0">تعبئة التقييم</Link>
              </li>
            )}
            {needsPostDiagnostic && (
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>التقييم التشخيصي البعدي — قارن مستواك الآن بما كان في البداية.</span>
                <Link href="/app/diagnostic" className="btn btn-sm btn-secondary shrink-0">تعبئة التقييم</Link>
              </li>
            )}
          </ul>
        </Card>
      )}

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
          {(week.remoteUrl || week.meetingPlace || week.note) && (
            <div className="flex flex-wrap gap-2 mt-3 items-center text-sm">
              {week.meetingPlace && <span className="badge badge-soft">المكان: {week.meetingPlace}</span>}
              {week.remoteUrl && (
                <a href={week.remoteUrl} target="_blank" rel="noopener" className="btn btn-sm btn-secondary">
                  <Video size={14} /> دخول حلقة النقاش
                </a>
              )}
              {week.note && <span className="badge">{week.note}</span>}
            </div>
          )}
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

      {/* التقدم — يتدفّق بعد رسم الصفحة، فلا يحبسها احتساب الدرجة */}
      <Suspense fallback={<ProgressSummarySkeleton />}>
        <ProgressSummary userId={user.id} fallbackAssignments={activeAssignments} />
      </Suspense>
    </>
  );
}
