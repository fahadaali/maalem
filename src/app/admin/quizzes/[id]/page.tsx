import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, BackLink, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addQuestion, deleteQuestion, deleteQuiz, publishQuiz, resetQuizAttempt, copyFromBank } from "../../actions";
import QuestionFields from "@/components/QuestionFields";
import { QUESTION_KINDS, QUIZ_TOPICS } from "@/lib/quiz";
import { cohortWhere } from "@/lib/cohort";
import { getActiveWeeks } from "@/lib/weeks";
import { parseJSON } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export const metadata = { title: "إدارة اختبار" };

export default async function AdminQuizDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const { ok, err } = await searchParams;
  const q = await db.quiz.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } }, attempts: { include: { user: true }, orderBy: { createdAt: "asc" } } } });
  if (!q) notFound();
  const [bank, weeks] = await Promise.all([
    db.bankQuestion.findMany({ where: await cohortWhere(), orderBy: { createdAt: "desc" }, take: 50 }),
    getActiveWeeks(),
  ]);

  return (
    <>
      <BackLink href="/admin/quizzes">الاختبارات</BackLink>
      <PageHeader
        title={q.title}
        subtitle={`${q.questions.length} أسئلة · حد النجاح ${q.passMark}%${q.week != null ? ` · الأسبوع ${q.week}` : ""}`}
        actions={
          <form action={publishQuiz} className="flex gap-2 items-center">
            <input type="hidden" name="id" value={q.id} />
            <input type="hidden" name="publish" value={q.published ? "0" : "1"} />
            <Badge tone={q.published ? "ink" : "default"}>{q.published ? "منشور" : "مسودة"}</Badge>
            <SubmitButton className="btn-sm" secondary={q.published}>{q.published ? "إخفاء" : "نشر وإشعار المشاركين"}</SubmitButton>
          </form>
        }
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-3">
          {q.questions.length === 0 ? <Empty>أضف الأسئلة من النموذج.</Empty> : q.questions.map((qq, i) => {
            const opts = parseJSON<string[]>(qq.options, []);
            return (
              <Card key={qq.id}>
                <div className="flex justify-between gap-2">
                  <div className="font-medium">{i + 1}. {qq.text}</div>
                  <form action={deleteQuestion}><input type="hidden" name="id" value={qq.id} /><button className="btn btn-ghost btn-sm" aria-label="حذف"><Trash2 size={14} /></button></form>
                </div>
                <div className="text-xs text-muted mt-0.5">{QUESTION_KINDS[qq.kind as keyof typeof QUESTION_KINDS] ?? qq.kind}</div>
                {qq.kind === "SHORT" ? (
                  <p className="text-sm mt-1">الإجابة: <span className="font-medium">{(qq.answers ?? "").split("|").join(" · ")}</span></p>
                ) : (
                  <ol className="text-sm mt-1 space-y-0.5">
                    {opts.map((o, oi) => <li key={oi} className={oi === qq.correctIndex ? "font-bold" : "text-muted"}>{oi === qq.correctIndex ? "✓ " : "· "}{o}</li>)}
                  </ol>
                )}
                {qq.explanation && <p className="text-xs text-muted mt-1">الشرح: {qq.explanation}</p>}
              </Card>
            );
          })}
          {q.attempts.length > 0 && (
            <Card title="النتائج">
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>المشارك</th><th>الدرجة</th><th>النسبة</th><th>الحالة</th><th>إعادة الفتح</th></tr></thead>
                  <tbody>
                    {q.attempts.map((a) => {
                      const pct = Math.round((a.score / a.total) * 100);
                      return (
                        <tr key={a.id}>
                          <td>{a.user.name}</td><td>{a.score}/{a.total}</td><td>{pct}%</td>
                          <td>{pct >= q.passMark ? <Badge tone="ink">ناجح</Badge> : <Badge>دون الحد</Badge>}</td>
                          <td>
                            <form action={resetQuizAttempt} className="flex gap-1 items-center">
                              <input type="hidden" name="quizId" value={q.id} />
                              <input type="hidden" name="userId" value={a.userId} />
                              <input name="reason" className="input" placeholder="السبب" />
                              <SubmitButton secondary className="btn-sm" pendingText="…">إعادة</SubmitButton>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card title="سؤال جديد">
            <form action={addQuestion}>
              <input type="hidden" name="quizId" value={q.id} />
              <QuestionFields showBankFields weeks={weeks.map((w) => ({ number: w.number, label: w.label }))} />
              <label className="flex items-center gap-2 text-sm mb-3">
                <input type="checkbox" name="toBank" /> احفظه في بنك الأسئلة أيضاً
              </label>
              <SubmitButton>إضافة السؤال</SubmitButton>
            </form>
          </Card>
          <Card title="نسخ من بنك الأسئلة" action={<Link href="/admin/bank" className="text-xs text-muted hover:text-ink">إدارة البنك</Link>}>
            {bank.length === 0 ? (
              <p className="text-sm text-muted">البنك فارغ. أضف أسئلة إليه لتنسخها هنا.</p>
            ) : (
              <form action={copyFromBank}>
                <input type="hidden" name="quizId" value={q.id} />
                <div className="max-h-72 overflow-y-auto space-y-1 mb-3">
                  {bank.map((b) => (
                    <label key={b.id} className="flex gap-2 items-start text-sm p-2 rounded-lg hover:bg-paper-2">
                      <input type="checkbox" name="pick" value={b.id} className="mt-1" />
                      <span>
                        {b.text}
                        <span className="text-xs text-muted block">
                          {QUESTION_KINDS[b.kind as keyof typeof QUESTION_KINDS] ?? b.kind} · {QUIZ_TOPICS[b.topic as keyof typeof QUIZ_TOPICS] ?? b.topic}
                          {b.week != null ? ` · الأسبوع ${b.week}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <SubmitButton secondary pendingText="جارٍ النسخ…">نسخ المحدد</SubmitButton>
              </form>
            )}
          </Card>
          <form action={deleteQuiz}><input type="hidden" name="id" value={q.id} /><button className="btn btn-ghost btn-sm text-muted">حذف الاختبار بالكامل</button></form>
        </div>
      </div>
    </>
  );
}
