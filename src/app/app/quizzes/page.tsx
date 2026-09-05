import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Badge, Empty } from "@/components/ui";

export const metadata = { title: "الاختبارات التكوينية" };

export default async function QuizzesPage() {
  const user = await requireRole("PARTICIPANT");
  const quizzes = await db.quiz.findMany({
    where: { published: true },
    orderBy: [{ week: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { questions: true } }, attempts: { where: { userId: user.id } } },
  });
  return (
    <>
      <PageHeader title="الاختبارات التكوينية" subtitle="اختبار قصير أسبوعي (10 أسئلة) في الفقه والمحفوظ. حد النجاح 70%." />
      {quizzes.length === 0 ? (
        <Empty>لا توجد اختبارات منشورة بعد.</Empty>
      ) : (
        <div className="space-y-2">
          {quizzes.map((q) => {
            const a = q.attempts[0];
            const pct = a ? Math.round((a.score / a.total) * 100) : null;
            return (
              <Link key={q.id} href={`/app/quizzes/${q.id}`} className="card flex items-center justify-between gap-3 hover:bg-paper-2">
                <div>
                  <div className="font-medium">{q.title}</div>
                  <div className="text-xs text-muted">{q.week != null ? `الأسبوع ${q.week} · ` : ""}{q._count.questions} أسئلة · {q.kind === "QURAN" ? "المحفوظ" : q.kind === "FIQH" ? "فقهي" : "عام"}</div>
                </div>
                {a ? <Badge tone={pct! >= q.passMark ? "ink" : "default"}>{pct}% {pct! >= q.passMark ? "ناجح" : "دون الحد"}</Badge> : <Badge tone="soft">لم يُؤدَّ</Badge>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
