import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { reviewReport } from "../actions";
import { ACTIVE_WEEKS, currentWeekNumber, formatDateTime, reportDueDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "التقارير الأسبوعية" };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ week?: string; ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const parsed = Number(sp.week);
  const week = sp.week != null && Number.isInteger(parsed) ? parsed : Math.max(0, Math.min(12, currentWeekNumber()));
  const [participants, reports] = await Promise.all([
    db.user.findMany({ where: { role: "PARTICIPANT", active: true }, orderBy: { name: "asc" } }),
    db.weeklyReport.findMany({ where: { week }, include: { user: true }, orderBy: { submittedAt: "asc" } }),
  ]);
  const byUser = new Map(reports.map((r) => [r.userId, r]));
  const due = reportDueDate(week);
  const rows = [
    ["الورد القرائي المنجز", "reading"], ["أبرز الفوائد", "benefits"], ["المهمة الأسبوعية", "taskProgress"], ["المعايشة الميدانية", "fieldNote"], ["نتيجة الاختبار", "quizResult"], ["تطبيق في الميدان", "application"], ["صعوبة تحتاج دعماً", "difficulty"],
  ] as const;

  return (
    <>
      <PageHeader title="مراجعة التقارير الأسبوعية" subtitle={`الأسبوع ${week} · موعد التسليم ${formatDateTime(due)}`} />
      <FormMessage ok={sp.ok} err={sp.err} />
      <div className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
        {ACTIVE_WEEKS.map((w) => (
          <Link key={w.number} href={`/admin/reports?week=${w.number}`} className={cn("badge shrink-0", w.number === week && "badge-ink")}>{w.number === 0 ? "الافتتاحي" : w.number}</Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mb-4">
        {participants.map((p) => {
          const r = byUser.get(p.id);
          return <span key={p.id} className={cn("badge", r && "badge-ink")}>{p.name}: {r ? (r.submittedAt > due ? "متأخر" : "مسلّم") : "لم يسلّم"}</span>;
        })}
      </div>
      {reports.length === 0 ? (
        <Empty>لا تقارير مسلّمة لهذا الأسبوع.</Empty>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <Card key={r.id} title={r.user.name} action={<div className="flex gap-1">{r.submittedAt > due && <Badge>تأخر</Badge>}{r.reviewedAt ? <Badge tone="ink">تمت المراجعة</Badge> : <Badge>بانتظار المراجعة</Badge>}</div>}>
              <div id={`r-${r.id}`} className="text-xs text-muted mb-2">سُلّم {formatDateTime(r.submittedAt)}</div>
              <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
                {rows.map(([label, key]) => r[key] ? <div key={key}><dt className="text-xs text-muted">{label}</dt><dd className="whitespace-pre-wrap">{r[key]}</dd></div> : null)}
              </dl>
              <form action={reviewReport} className="border-t border-line pt-3">
                <input type="hidden" name="id" value={r.id} />
                <div className="field"><label className="label">تغذية راجعة للمشارك</label><textarea name="feedback" className="textarea" rows={2} defaultValue={r.feedback ?? ""} /></div>
                <SubmitButton secondary className="btn-sm">{r.reviewedAt ? "تحديث المراجعة" : "اعتماد المراجعة"}</SubmitButton>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
