import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, BackLink, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addQuestion, deleteQuestion, deleteQuiz, publishQuiz } from "../../actions";
import { parseJSON } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export const metadata = { title: "إدارة اختبار" };

export default async function AdminQuizDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const { ok, err } = await searchParams;
  const q = await db.quiz.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } }, attempts: { include: { user: true }, orderBy: { createdAt: "asc" } } } });
  if (!q) notFound();

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
                <ol className="text-sm mt-1 space-y-0.5">
                  {opts.map((o, oi) => <li key={oi} className={oi === qq.correctIndex ? "font-bold" : "text-muted"}>{oi === qq.correctIndex ? "✓ " : "· "}{o}</li>)}
                </ol>
              </Card>
            );
          })}
          {q.attempts.length > 0 && (
            <Card title="النتائج">
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>المشارك</th><th>الدرجة</th><th>النسبة</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {q.attempts.map((a) => {
                      const pct = Math.round((a.score / a.total) * 100);
                      return <tr key={a.id}><td>{a.user.name}</td><td>{a.score}/{a.total}</td><td>{pct}%</td><td>{pct >= q.passMark ? <Badge tone="ink">ناجح</Badge> : <Badge>دون الحد</Badge>}</td></tr>;
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
              <div className="field"><label className="label">نص السؤال</label><textarea name="text" className="textarea" rows={2} required /></div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="field flex items-center gap-2">
                  <input type="radio" name="correctIndex" value={i} required={i === 0} className="accent-black" title="الإجابة الصحيحة" />
                  <input name={`opt${i}`} className="input" placeholder={`الخيار ${i + 1}${i > 1 ? " (اختياري)" : ""}`} required={i < 2} />
                </div>
              ))}
              <p className="text-xs text-muted mb-3">حدد الدائرة بجانب الإجابة الصحيحة.</p>
              <SubmitButton>إضافة السؤال</SubmitButton>
            </form>
          </Card>
          <form action={deleteQuiz}><input type="hidden" name="id" value={q.id} /><button className="btn btn-ghost btn-sm text-muted">حذف الاختبار بالكامل</button></form>
        </div>
      </div>
    </>
  );
}
