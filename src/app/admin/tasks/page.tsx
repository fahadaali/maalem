import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { createAssignment, createMissingAssignments } from "../actions";
import { loadProgram } from "@/lib/participant-data";
import { missingAssignments, weekName } from "@/lib/obligations";
import { reportDueFrom } from "@/lib/dates";
import { formatShort, toLocalInput } from "@/lib/dates";
import { currentWeekNumber, getActiveWeeks, reportDueDate } from "@/lib/weeks";
import { getCompetencies } from "@/lib/content";
import { cohortWhere, participantsWhere } from "@/lib/cohort";

export const metadata = { title: "المهام والتقييم" };

export default async function AdminTasksPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const [assignments, participantsCount] = await Promise.all([
    db.assignment.findMany({ where: await cohortWhere(), orderBy: [{ week: "asc" }, { dueAt: "asc" }], include: { submissions: { select: { gradedAt: true } } } }),
    db.user.count({ where: await participantsWhere() }),
  ]);
  const nextWeek = Math.max(0, Math.min(12, (await currentWeekNumber()) + 1));
  const activeWeeks = await getActiveWeeks();
  const program = await loadProgram();
  const missing = missingAssignments(program);
  const now = Date.now();
  // موعدٌ افتراضي لا يُولد متأخراً: خميس أسبوعها، أو بعد أسبوع من اليوم إن كان خميسها قد مضى
  const defaultDue = (week: number) => {
    const w = activeWeeks.find((x) => x.number === week);
    const thursday = w ? reportDueFrom(w.gregorian).getTime() : now;
    return new Date(Math.max(thursday, now + 7 * 86400000));
  };

  return (
    <>
      <PageHeader title="المهام الأسبوعية والتقييم" subtitle="أنشئ المهام وقيّم التسليمات بسلم التقدير (ملحق 2)." />
      <FormMessage ok={ok} err={err} />
      {missing.length > 0 && (
        <Card title={`مهام في الجدول بلا باب تسليم (${missing.length})`} className="mb-4 border-ink">
          <p className="text-sm text-muted -mt-1 mb-3">
            هذه مهامّ مكتوبة في جدول الأسابيع، يراها المشارك في بطاقة أسبوعه ويرصدها في تقريره، ولا مهمةَ تسليمٍ تقابلها فلا يجد أين يسلّمها.
            حدّد ما يُسلَّم منها وموعده ثم أنشئه. وإضافة مهمة ترفع مقام درجة المهام للجميع، فما يُنجز في صفحةٍ أخرى (كالخطة والمشروع) غير محدَّد افتراضياً.
          </p>
          <form action={createMissingAssignments}>
            <div className="table-wrap mb-3">
              <table className="table">
                <thead><tr><th></th><th>الأسبوع</th><th>المهمة</th><th>موعد التسليم</th></tr></thead>
                <tbody>
                  {missing.map((m, i) => (
                    <tr key={`${m.week}-${m.title}`}>
                      <td><input type="checkbox" name="pick" value={i} defaultChecked={!m.native} className="accent-black" aria-label={`إنشاء «${m.title}»`} /></td>
                      <td className="whitespace-nowrap">{weekName(m.week)}</td>
                      <td>
                        {m.title}
                        {m.native && <div className="text-xs text-muted">يُنجز في صفحة: {m.native}</div>}
                        <input type="hidden" name={`title_${i}`} value={m.title} />
                        <input type="hidden" name={`week_${i}`} value={m.week} />
                      </td>
                      <td><input type="datetime-local" name={`due_${i}`} className="input" dir="ltr" defaultValue={toLocalInput(defaultDue(m.week))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SubmitButton>إنشاء المحدَّد وإشعار المشاركين</SubmitButton>
          </form>
        </Card>
      )}
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
                  {activeWeeks.map((w) => <option key={w.number} value={w.number}>{w.number === 0 ? "الافتتاحي" : `الأسبوع ${w.number}`}</option>)}
                </select>
              </div>
              <div className="field"><label className="label">موعد التسليم</label><input type="datetime-local" name="dueAt" className="input" required defaultValue={toLocalInput(await reportDueDate(nextWeek))} /></div>
            </div>
            <div className="field">
              <label className="label">الكفاءة</label>
              <select name="competency" className="select" defaultValue="">
                <option value="">—</option>
                {(await getCompetencies()).map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
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
