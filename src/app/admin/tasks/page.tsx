import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { createAssignment } from "../actions";
import { ACTIVE_WEEKS, currentWeekNumber, formatShort, reportDueDate } from "@/lib/dates";
import { COMPETENCIES } from "@/lib/program";

export const metadata = { title: "المهام والتقييم" };

function toLocalInput(d: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(" ", "T");
}

export default async function AdminTasksPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const [assignments, participantsCount] = await Promise.all([
    db.assignment.findMany({ orderBy: [{ week: "asc" }, { dueAt: "asc" }], include: { submissions: { select: { gradedAt: true } } } }),
    db.user.count({ where: { role: "PARTICIPANT", active: true } }),
  ]);
  const nextWeek = Math.max(0, Math.min(12, currentWeekNumber() + 1));

  return (
    <>
      <PageHeader title="المهام الأسبوعية والتقييم" subtitle="أنشئ المهام وقيّم التسليمات بسلم التقدير (ملحق 2)." />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_360px] gap-4 items-start">
        <div>
          {assignments.length === 0 ? <Empty>لا مهام بعد.</Empty> : (
            <div className="space-y-2">
              {assignments.map((a) => {
                const graded = a.submissions.filter((s) => s.gradedAt).length;
                return (
                  <Link key={a.id} href={`/admin/tasks/${a.id}`} className="card flex items-center justify-between gap-3 hover:bg-paper-2">
                    <div className="min-w-0">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted">الأسبوع {a.week} · التسليم {formatShort(a.dueAt)}{a.competency ? ` · ${a.competency}` : ""}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge>{a.submissions.length}/{participantsCount} مسلّم</Badge>
                      <Badge tone={graded === a.submissions.length && graded > 0 ? "ink" : "soft"}>{graded} مقيّم</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <Card title="مهمة جديدة">
          <form action={createAssignment}>
            <div className="field"><label className="label">العنوان</label><input name="title" className="input" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">الأسبوع</label>
                <select name="week" className="select" defaultValue={nextWeek}>
                  {ACTIVE_WEEKS.map((w) => <option key={w.number} value={w.number}>{w.number === 0 ? "الافتتاحي" : `الأسبوع ${w.number}`}</option>)}
                </select>
              </div>
              <div className="field"><label className="label">موعد التسليم</label><input type="datetime-local" name="dueAt" className="input" required defaultValue={toLocalInput(reportDueDate(nextWeek))} /></div>
            </div>
            <div className="field">
              <label className="label">الكفاءة</label>
              <select name="competency" className="select" defaultValue="">
                <option value="">—</option>
                {COMPETENCIES.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label className="label">الوصف والمتطلبات</label><textarea name="description" className="textarea" /></div>
            <SubmitButton>إضافة وإشعار المشاركين</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
