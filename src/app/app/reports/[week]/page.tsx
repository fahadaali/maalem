import { notFound } from "next/navigation";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, BackLink, Alert } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveWeeklyReport } from "../../actions";
import { formatDateTime, getWeek, reportDueDate } from "@/lib/dates";

export const metadata = { title: "التقرير الأسبوعي" };

export default async function WeeklyReportPage({ params, searchParams }: { params: Promise<{ week: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { week: w } = await params;
  const { ok, err } = await searchParams;
  const week = Number(w);
  const info = getWeek(week);
  if (!info || week > 12) notFound();
  const [report, quizzes, cards] = await Promise.all([
    db.weeklyReport.findUnique({ where: { userId_week: { userId: user.id, week } } }),
    db.quizAttempt.findMany({ where: { userId: user.id, quiz: { week } }, include: { quiz: true } }),
    db.readingCard.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 5 }),
  ]);
  const suggestedReading = cards.length ? `${cards[cards.length - 1].book} ص ${Math.min(...cards.map((c) => c.fromPage))}–${Math.max(...cards.map((c) => c.toPage))}` : info.reading;
  const suggestedQuiz = quizzes.map((q) => `${q.quiz.title}: ${q.score}/${q.total}`).join("، ");

  return (
    <>
      <BackLink href="/app/reports">التقارير الأسبوعية</BackLink>
      <PageHeader title={`تقرير الأسبوع ${info.label}`} subtitle={`${info.competency} · موعد التسليم ${formatDateTime(reportDueDate(week))}`} />
      <FormMessage ok={ok} err={err} />
      {report?.feedback && (
        <Alert tone="success">
          <div className="font-medium mb-1">تغذية راجعة من مدير المشروع</div>
          <div className="whitespace-pre-wrap">{report.feedback}</div>
        </Alert>
      )}
      <Card>
        <form action={saveWeeklyReport}>
          <input type="hidden" name="week" value={week} />
          <Field label="الورد القرائي المنجز (الكتاب والصفحات)" name="reading" value={report?.reading ?? suggestedReading} required />
          <Field label="أبرز ثلاث فوائد من القراءة" name="benefits" value={report?.benefits} required rows={4} />
          <Field label="المهمة الأسبوعية: ما أُنجز ونسبة الإنجاز" name="taskProgress" value={report?.taskProgress} required hint={info.task} />
          <Field label="المعايشة الميدانية: التاريخ والمدة وأهم ملاحظة" name="fieldNote" value={report?.fieldNote} />
          <Field label="نتيجة الاختبار التكويني" name="quizResult" value={report?.quizResult ?? suggestedQuiz} single />
          <Field label="تطبيق واحد نفذته هذا الأسبوع في ميداني" name="application" value={report?.application} />
          <Field label="صعوبة واجهتني وأحتاج دعماً فيها" name="difficulty" value={report?.difficulty} />
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
      {hint && <div className="text-xs text-muted mb-1">المهمة: {hint}</div>}
      {single ? (
        <input id={name} name={name} className="input" defaultValue={value ?? ""} required={required} />
      ) : (
        <textarea id={name} name={name} className="textarea" rows={rows} defaultValue={value ?? ""} required={required} />
      )}
    </div>
  );
}
