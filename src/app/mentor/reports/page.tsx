import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { mentorReviewReport } from "../actions";
import { formatDateTime } from "@/lib/dates";
import { currentWeekNumber, getActiveWeeks, reportDueDate } from "@/lib/weeks";
import { cn } from "@/lib/utils";

export const metadata = { title: "تقارير مجموعتي" };

const ROWS = [
  ["الورد القرائي المنجز", "reading"],
  ["أبرز الفوائد", "benefits"],
  ["المهمة الأسبوعية", "taskProgress"],
  ["المعايشة الميدانية", "fieldNote"],
  ["نتيجة الاختبار", "quizResult"],
  ["تطبيق في الميدان", "application"],
  ["صعوبة تحتاج دعماً", "difficulty"],
] as const;

export default async function MentorReportsPage({ searchParams }: { searchParams: Promise<{ week?: string; ok?: string; err?: string }> }) {
  const me = await requireRole("MENTOR");
  const sp = await searchParams;
  const parsed = Number(sp.week);
  const week = sp.week != null && Number.isInteger(parsed) ? parsed : Math.max(0, Math.min(12, await currentWeekNumber()));
  const [weeks, mentees] = await Promise.all([
    getActiveWeeks(),
    db.user.findMany({ where: { mentorId: me.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const ids = mentees.map((m) => m.id);
  const reports = await db.weeklyReport.findMany({ where: { week, userId: { in: ids } }, include: { user: true }, orderBy: { submittedAt: "asc" } });
  const submitted = new Set(reports.map((r) => r.userId));
  const due = await reportDueDate(week);

  return (
    <>
      <PageHeader
        title="تقارير مجموعتي الأسبوعية"
        subtitle={`الأسبوع ${week} · موعد التسليم ${formatDateTime(due)} — تقارير من رُبطوا بك وحدهم.`}
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      {mentees.length === 0 ? (
        <Empty>لم يُربط بك مشاركون بعد.</Empty>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
            {weeks.map((w) => (
              <Link key={w.number} href={`/mentor/reports?week=${w.number}`} className={cn("badge shrink-0", w.number === week && "badge-ink")}>
                {w.number === 0 ? "الافتتاحي" : w.number}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mb-4">
            {mentees.map((m) => (
              <span key={m.id} className={cn("badge", submitted.has(m.id) && "badge-ink")}>{m.name}: {submitted.has(m.id) ? "مسلّم" : "لم يسلّم"}</span>
            ))}
          </div>
          {reports.length === 0 ? (
            <Empty>لا تقارير مسلّمة لهذا الأسبوع في مجموعتك.</Empty>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => (
                <Card
                  key={r.id}
                  title={<Link href={`/mentor/participants/${r.userId}`} className="hover:underline">{r.user.name}</Link>}
                  action={r.reviewedAt ? <Badge tone="ink">روجِع</Badge> : <Badge>بانتظار المراجعة</Badge>}
                >
                  <div className="text-xs text-muted mb-2">سُلّم {formatDateTime(r.submittedAt)}{r.submittedAt > due ? " — متأخراً" : ""}</div>
                  <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
                    {ROWS.map(([label, key]) => (r[key] ? <div key={key}><dt className="text-xs text-muted">{label}</dt><dd className="whitespace-pre-wrap">{r[key]}</dd></div> : null))}
                  </dl>
                  <form action={mentorReviewReport} className="border-t border-line pt-3">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="field"><label className="label">تغذية راجعة للمشارك</label><textarea name="feedback" className="textarea" rows={2} required defaultValue={r.feedback ?? ""} /></div>
                    <SubmitButton secondary className="btn-sm">{r.reviewedAt ? "تحديث التغذية الراجعة" : "حفظ وإشعار المشارك"}</SubmitButton>
                  </form>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
