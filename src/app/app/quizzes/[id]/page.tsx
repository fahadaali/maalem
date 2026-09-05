import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, BackLink, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { submitQuiz } from "../../actions";
import { parseJSON } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "اختبار" };

export default async function QuizPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  const user = await requireRole("PARTICIPANT", "ADMIN");
  const { id } = await params;
  const { err } = await searchParams;
  const quiz = await db.quiz.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } }, attempts: { where: { userId: user.id } } } });
  if (!quiz || !quiz.published) notFound();
  const attempt = quiz.attempts[0];
  const answers = attempt ? parseJSON<number[]>(attempt.answers, []) : [];
  const pct = attempt ? Math.round((attempt.score / attempt.total) * 100) : 0;

  return (
    <>
      <BackLink href="/app/quizzes">الاختبارات</BackLink>
      <PageHeader title={quiz.title} subtitle={`${quiz.questions.length} أسئلة · حد النجاح ${quiz.passMark}%`} actions={attempt && <Badge tone={pct >= quiz.passMark ? "ink" : "default"}>{attempt.score}/{attempt.total} · {pct}%</Badge>} />
      <FormMessage err={err} />
      {attempt ? (
        <div className="space-y-3">
          {quiz.questions.map((q, i) => {
            const opts = parseJSON<string[]>(q.options, []);
            return (
              <Card key={q.id}>
                <div className="font-medium mb-2">{i + 1}. {q.text}</div>
                <ul className="space-y-1 text-sm">
                  {opts.map((o, oi) => (
                    <li key={oi} className={cn("px-3 py-1.5 rounded-lg border", oi === q.correctIndex ? "border-ink bg-paper-2 font-medium" : answers[i] === oi ? "border-line-2 line-through text-muted" : "border-line")}>
                      {o}
                      {oi === q.correctIndex && <span className="text-xs text-muted ms-2">(الإجابة الصحيحة)</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : (
        <form action={submitQuiz}>
          <input type="hidden" name="quizId" value={quiz.id} />
          <div className="space-y-3">
            {quiz.questions.map((q, i) => {
              const opts = parseJSON<string[]>(q.options, []);
              return (
                <Card key={q.id}>
                  <div className="font-medium mb-2">{i + 1}. {q.text}</div>
                  <div className="space-y-1">
                    {opts.map((o, oi) => (
                      <label key={oi} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line hover:bg-paper-2 cursor-pointer text-sm">
                        <input type="radio" name={`q_${q.id}`} value={oi} required className="accent-black" />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="mt-4">
            <SubmitButton pendingText="جارٍ التصحيح…">تسليم الإجابات</SubmitButton>
            <span className="text-xs text-muted ms-3">محاولة واحدة فقط.</span>
          </div>
        </form>
      )}
    </>
  );
}
