import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { createQuiz } from "../actions";
import { ACTIVE_WEEKS, currentWeekNumber } from "@/lib/dates";

export const metadata = { title: "الاختبارات التكوينية" };

export default async function AdminQuizzesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const quizzes = await db.quiz.findMany({ orderBy: [{ week: "asc" }, { createdAt: "asc" }], include: { _count: { select: { questions: true, attempts: true } }, attempts: true } });
  return (
    <>
      <PageHeader title="الاختبارات التكوينية" subtitle="10 اختبارات قصيرة (فقهية وقرآنية) خلال البرنامج، 10 أسئلة لكل اختبار، حد النجاح 70%." />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_340px] gap-4 items-start">
        <div>
          {quizzes.length === 0 ? <Empty>لا اختبارات بعد.</Empty> : (
            <div className="space-y-2">
              {quizzes.map((q) => {
                const avg = q.attempts.length ? Math.round((q.attempts.reduce((s, a) => s + a.score / a.total, 0) / q.attempts.length) * 100) : null;
                return (
                  <Link key={q.id} href={`/admin/quizzes/${q.id}`} className="card flex items-center justify-between gap-3 hover:bg-paper-2">
                    <div>
                      <div className="font-medium">{q.title}</div>
                      <div className="text-xs text-muted">{q.week != null ? `الأسبوع ${q.week} · ` : ""}{q._count.questions} أسئلة · {q._count.attempts} محاولة{avg != null ? ` · متوسط ${avg}%` : ""}</div>
                    </div>
                    <Badge tone={q.published ? "ink" : "default"}>{q.published ? "منشور" : "مسودة"}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <Card title="اختبار جديد">
          <form action={createQuiz}>
            <div className="field"><label className="label">العنوان</label><input name="title" className="input" required placeholder="اختبار فقهي 1 — الطهارة" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">النوع</label>
                <select name="kind" className="select" defaultValue="FIQH"><option value="FIQH">فقهي</option><option value="QURAN">المحفوظ</option><option value="OTHER">عام (إسعافات أولية…)</option></select>
              </div>
              <div className="field">
                <label className="label">الأسبوع</label>
                <select name="week" className="select" defaultValue={Math.max(1, Math.min(12, currentWeekNumber()))}>
                  <option value="">—</option>
                  {ACTIVE_WEEKS.filter((w) => w.number > 0).map((w) => <option key={w.number} value={w.number}>الأسبوع {w.number}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label className="label">حد النجاح %</label><input type="number" name="passMark" className="input" defaultValue={70} min={0} max={100} /></div>
            <SubmitButton>إنشاء وإضافة الأسئلة</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
