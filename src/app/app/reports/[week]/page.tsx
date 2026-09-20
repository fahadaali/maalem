import { notFound } from "next/navigation";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, BackLink, Alert } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveWeeklyReport } from "../../actions";
import { formatDateTime } from "@/lib/dates";
import { getWeekByNumber, getWeekTasks, reportDueDate } from "@/lib/weeks";
import { TASK_STATUS, publishedQuizWeeks, reportSections } from "@/lib/report";

export const metadata = { title: "التقرير الأسبوعي" };

export default async function WeeklyReportPage({ params, searchParams }: { params: Promise<{ week: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { week: w } = await params;
  const { ok, err } = await searchParams;
  const week = Number(w);
  const info = await getWeekByNumber(week);
  if (!info || week > 12) notFound();
  const [report, quizzes, cards, tasks, quizWeeks] = await Promise.all([
    db.weeklyReport.findUnique({ where: { userId_week: { userId: user.id, week } }, include: { tasks: true } }),
    db.quizAttempt.findMany({ where: { userId: user.id, quiz: { week } }, include: { quiz: true } }),
    db.readingCard.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 5 }),
    getWeekTasks(week),
    publishedQuizWeeks(),
  ]);
  // لا يُفتح من النموذج إلا ما يطلبه الأسبوع: حقلٌ فارغٌ لا يُطلب يُقرأ إنذاراً لا خبراً
  const show = reportSections(info, { quizWeeks, taskCount: tasks.length });
  const saved = new Map(report?.tasks.map((t) => [t.taskId, t]) ?? []);
  // نطاق الصفحات من بطاقات الكتاب الأخير وحده، فلا يُخلط كتابان في سطر واحد
  const latestBook = cards[0]?.book;
  const ofBook = cards.filter((c) => c.book === latestBook);
  const suggestedReading = ofBook.length ? `${latestBook} ص ${Math.min(...ofBook.map((c) => c.fromPage))}–${Math.max(...ofBook.map((c) => c.toPage))}` : info.reading;
  const suggestedQuiz = quizzes.map((q) => `${q.quiz.title}: ${q.score}/${q.total}`).join("، ");

  return (
    <>
      <BackLink href="/app/reports">التقارير الأسبوعية</BackLink>
      <PageHeader title={`تقرير الأسبوع ${info.label}`} subtitle={`${info.competency} · موعد التسليم ${formatDateTime(await reportDueDate(week))}`} />
      <FormMessage ok={ok} err={err} />
      {report?.feedback && (
        <Alert tone="success">
          <div className="font-medium mb-1">تغذية راجعة من مدير المشروع</div>
          <div className="whitespace-pre-wrap">{report.feedback}</div>
        </Alert>
      )}
      <Card>
        {/* مفتاحٌ بالأسبوع: التنقّل بين الأسابيع من طرف العميل يبقي الحقول مركَّبة
            فلا تتبع قيمُها الأسبوعَ الجديد. وحقول المهام مسمّاة بمعرّفاتها، فلولا
            المفتاح لرُصدت إجابةُ أسبوعٍ على مهامّ أسبوعٍ آخر. */}
        <form key={week} action={saveWeeklyReport}>
          <input type="hidden" name="week" value={week} />
          {show.tasks && (
            <div className="field">
              <div className="label">مهام الأسبوع</div>
              <div className="space-y-3">
                {tasks.map((t, i) => (
                  <div key={t.id}>
                    <label className="label !mb-1" htmlFor={`status_${t.id}`}>
                      <span className="text-muted tabular-nums">{i + 1}.</span> {t.title}
                    </label>
                    <div className="grid md:grid-cols-[11rem_1fr] gap-2">
                      <select id={`status_${t.id}`} name={`status_${t.id}`} className="select" required defaultValue={saved.get(t.id)?.status ?? ""}>
                        <option value="" disabled>— الحالة —</option>
                        {Object.entries(TASK_STATUS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                      <input name={`note_${t.id}`} className="input" defaultValue={saved.get(t.id)?.note ?? ""} placeholder="ملاحظة قصيرة (اختياري)" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* تقريرٌ سُلّم قبل تفصيل المهام: نصُّه القديم يُقرأ ولا يُحرَّر */}
          {report && report.tasks.length === 0 && report.taskProgress && (
            <div className="field">
              <div className="label">المهمة الأسبوعية (كما سُلّمت سابقاً)</div>
              <div className="whitespace-pre-wrap text-sm text-muted">{report.taskProgress}</div>
            </div>
          )}
          {show.reading && (
            <>
              <Field label="الورد القرائي المنجز (الكتاب والصفحات)" name="reading" value={report?.reading || suggestedReading} required />
              <Field label="أبرز ثلاث فوائد من القراءة" name="benefits" value={report?.benefits} required rows={4} />
            </>
          )}
          {show.field && <Field label="المعايشة الميدانية: التاريخ والمدة وأهم ملاحظة" name="fieldNote" value={report?.fieldNote} hint={info.field} />}
          {show.quiz && <Field label="نتيجة الاختبار التكويني" name="quizResult" value={report?.quizResult || suggestedQuiz} single />}
          {show.reflect && (
            <>
              <Field label="تطبيق واحد نفذته هذا الأسبوع في ميداني" name="application" value={report?.application} />
              <Field label="صعوبة واجهتني وأحتاج دعماً فيها" name="difficulty" value={report?.difficulty} />
            </>
          )}
          <SubmitButton>{report ? "تحديث التقرير" : "تسليم التقرير"}</SubmitButton>
          {report && <span className="text-xs text-muted ms-3">آخر تسليم: {formatDateTime(report.submittedAt)}</span>}
        </form>
      </Card>
    </>
  );
}

function Field({ label, name, value, required, rows = 3, hint, single }: { label: string; name: string; value?: string | null; required?: boolean; rows?: number; hint?: string; single?: boolean }) {
  return (
    <div className="field">
      <label className="label" htmlFor={name}>{label}</label>
      {hint && <div className="text-xs text-muted mb-1">{hint}</div>}
      {single ? (
        <input id={name} name={name} className="input" defaultValue={value ?? ""} required={required} />
      ) : (
        <textarea id={name} name={name} className="textarea" rows={rows} defaultValue={value ?? ""} required={required} />
      )}
    </div>
  );
}
