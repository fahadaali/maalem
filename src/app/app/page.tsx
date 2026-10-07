import Link from "@/components/Link";
import { Suspense } from "react";
import { requireParticipantView } from "@/lib/auth";
import { optional } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import FormMessage from "@/components/FormMessage";
import WeekCard from "@/components/WeekCard";
import ObligationList from "@/components/ObligationList";
import { dayName, formatHijri, formatGregorian, todayKey, weekdayIndex } from "@/lib/dates";
import { resolveCurrentWeek } from "@/lib/weeks";
import { buildWeekStates } from "@/lib/week-state";
import { listAttachments } from "@/lib/attachments";
import { activeCohort } from "@/lib/cohort";
import ProgressSummary, { ProgressSummarySkeleton } from "@/components/ProgressSummary";
import { PARTICIPANT_ROUTINE } from "@/lib/program";
import { unreadCount } from "@/lib/notify";
import { emptyParticipant, loadParticipant, loadProgram } from "@/lib/participant-data";
import { obligationsForView } from "@/lib/obligations";
import { returnedIds } from "@/lib/returns";

export const metadata = { title: "الرئيسية" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const { err, ok: okMsg } = await searchParams;
  const user = await requireParticipantView();
  const now = new Date();
  /**
   * صفوف المشارك وجدول الدفعة من المُحمِّل المشترك: يقرؤها هيكلُ التطبيق لعدّاد
   * «مهامي» في الطلب نفسه، فلا تُجلب هنا مرة ثانية. وكانت هذه الصفحة تستعلم وحدها
   * ثمانية عشر استعلاماً لما صار يُقرأ من هناك.
   */
  const [loaded, program] = await Promise.all([loadParticipant(user.id), loadProgram()]);
  const rows = loaded ?? emptyParticipant(user.id);
  const weeks = program.weeks;
  const weekNo = resolveCurrentWeek(weeks, now);
  const week = weeks.find((w) => w.number === weekNo);
  const wd = weekdayIndex(now);
  const today = todayKey(now);

  const [unread, cohort, weekStates, weekFiles, obligations] = await Promise.all([
    // زينةٌ كشارة الهيكل — و`Promise.all` يُسقط الصفحة كلَّها برفضِ واحد منها
    optional(() => unreadCount(user.id), 0, "home.badge-skipped"),
    activeCohort(),
    buildWeekStates(user.id, weeks, now),
    week?.id ? listAttachments({ kind: "WEEKCARD", refId: week.id }) : [],
    obligationsForView(user, now),
  ]);
  // الحالة للأسبوع الجاري فحسب — بطاقة الرئيسية لا تعرض غيره
  const weekState = week ? weekStates.get(week.number) : undefined;
  const cardUrl = weekFiles[0]?.url;
  const todayCard = rows.cards.some((c) => todayKey(c.date) === today);
  const returnedReports = returnedIds(rows.returns, "WEEKLY_REPORT");
  const report = rows.reports.find((r) => r.week === weekNo && !returnedReports.has(r.id));
  // اختبار الأسبوع الجاري الذي لم يُؤدَّ — لا أوّل اختبارٍ منشور أيّاً كان أسبوعه
  const attempted = new Set(rows.attempts.map((a) => a.quizId));
  const weekQuiz = program.quizzes.find((q) => q.published && q.questions > 0 && q.week === weekNo && !attempted.has(q.id));
  // ما يحتاج عملاً الآن: المُرجَع والمتأخر ثم مطلوب هذا الأسبوع — والبقية في «مهامي»
  const pressing = (obligations?.items ?? []).filter((o) => o.state === "returned" || o.state === "overdue" || o.state === "due");

  // يوما الثلاثاء والخميس لهما مهمتان خاصتان في الروتين، فيُبحث عنهما قبل نطاق «الأحد – الخميس»
  const routineDay = wd === 6 ? "السبت" : wd === 2 ? "الثلاثاء" : wd === 4 ? "الخميس" : wd === 5 ? "الجمعة" : "الأحد – الخميس";
  const routine = weekNo < 0 || weekNo > 13 ? undefined : PARTICIPANT_ROUTINE.find((r) => r.day === routineDay) ?? PARTICIPANT_ROUTINE.find((r) => r.day === "الأحد – الخميس");
  const isReadingDay = wd >= 0 && wd <= 4;

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

      {/* مطلوب منك: من «مهامي» نفسها، فلا يختفي ما تأخّر ولا يُسأل عنه في بابٍ آخر */}
      <Card
        className={pressing.some((o) => o.state === "returned" || o.state === "overdue") ? "mb-4 border-ink" : "mb-4"}
        title="مطلوب منك"
        action={<Link href="/app/tasks" className="text-sm underline hover:text-ink">كل مهامي{pressing.length ? ` (${pressing.length})` : ""}</Link>}
      >
        {pressing.length === 0 ? (
          <p className="text-sm text-muted">لا شيء متأخر ولا مطلوب هذا الأسبوع. أحسنت.</p>
        ) : (
          <>
            {obligations && obligations.outstanding > 0 && (
              <p className="text-sm -mt-1 mb-1">
                {obligations.counts.returned > 0 && <>أُرجع إليك {obligations.counts.returned} للتعديل · </>}
                {obligations.counts.overdue > 0 && <>متأخر {obligations.counts.overdue}</>}
              </p>
            )}
            <ObligationList items={pressing.slice(0, 5)} now={now} />
            {pressing.length > 5 && <Link href="/app/tasks" className="btn btn-sm btn-secondary mt-2">والمزيد في «مهامي» ({pressing.length - 5})</Link>}
          </>
        )}
      </Card>

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
          {wd === 2 && weekQuiz && (
            <Link href={`/app/quizzes/${weekQuiz.id}`} className="btn btn-sm btn-secondary">
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
            <Link href={`/app/week?week=${weekNo}`} className="btn btn-sm btn-secondary">محتوى لقاء اليوم</Link>
          )}
        </div>
      </Card>

      {/* بطاقة الأسبوع */}
      {week && weekNo <= 14 && (
        <div className="mb-4">
          <WeekCard week={week} total={13} cohortName={cohort?.name} state={weekState} current cardUrl={cardUrl} />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Link href="/app/week" className="text-xs text-muted underline">بطاقات الأسابيع كلها</Link>
            {unread > 0 && <Link href="/app/notifications" className="badge">{unread} إشعار جديد</Link>}
          </div>
        </div>
      )}

      {/* التقدم — يتدفّق بعد رسم الصفحة، فلا يحبسها احتساب الدرجة */}
      <Suspense fallback={<ProgressSummarySkeleton />}>
        <ProgressSummary userId={user.id} fallbackAssignments={program.assignments.length} />
      </Suspense>
    </>
  );
}
