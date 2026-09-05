import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, BackLink, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { deleteAssignment, gradeSubmission, updateAssignment } from "../../actions";
import { ACTIVE_WEEKS, formatDateTime } from "@/lib/dates";
import { COMPETENCIES, RUBRIC_LEVEL_LABELS, TASK_RUBRIC } from "@/lib/program";

export const metadata = { title: "تقييم مهمة" };

function toLocalInput(d: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(" ", "T");
}

export default async function AdminTaskDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const { ok, err } = await searchParams;
  const a = await db.assignment.findUnique({ where: { id }, include: { submissions: { include: { user: true }, orderBy: { submittedAt: "asc" } } } });
  if (!a) notFound();
  const participants = await db.user.findMany({ where: { role: "PARTICIPANT", active: true }, orderBy: { name: "asc" } });
  const submittedIds = new Set(a.submissions.map((s) => s.userId));
  const missing = participants.filter((p) => !submittedIds.has(p.id));

  return (
    <>
      <BackLink href="/admin/tasks">المهام</BackLink>
      <PageHeader title={a.title} subtitle={`الأسبوع ${a.week} · موعد التسليم ${formatDateTime(a.dueAt)}`} />
      <FormMessage ok={ok} err={err} />
      {missing.length > 0 && <div className="card card-muted text-sm mb-4">لم يسلّم بعد: {missing.map((m) => m.name).join("، ")}</div>}

      {a.submissions.length === 0 ? <Empty>لا تسليمات بعد.</Empty> : (
        <div className="space-y-4">
          {a.submissions.map((s) => {
            const late = s.submittedAt > a.dueAt;
            const total = s.gradedAt ? (s.completeness ?? 0) + (s.referencing ?? 0) + (s.application ?? 0) + (s.punctuality ?? 0) : null;
            const defaults: Record<string, number | null> = { completeness: s.completeness, referencing: s.referencing, application: s.application, punctuality: late ? (s.punctuality ?? 2) : (s.punctuality ?? 3) };
            return (
              <Card key={s.id} title={s.user.name} action={<div className="flex gap-1">{late && <Badge>متأخر</Badge>}{total != null ? <Badge tone="ink">{total}/16</Badge> : <Badge>غير مقيّم</Badge>}</div>}>
                <div className="text-xs text-muted mb-1">سُلّم {formatDateTime(s.submittedAt)}</div>
                <div className="text-sm whitespace-pre-wrap mb-2">{s.content}</div>
                {s.link && <a href={s.link} target="_blank" rel="noopener" className="text-sm underline break-all" dir="ltr">{s.link}</a>}
                <form action={gradeSubmission} className="border-t border-line pt-3 mt-3">
                  <input type="hidden" name="id" value={s.id} />
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>المعيار</th>{RUBRIC_LEVEL_LABELS.map((l) => <th key={l} className="text-center">{l}</th>)}</tr></thead>
                      <tbody>
                        {TASK_RUBRIC.map((r) => (
                          <tr key={r.key}>
                            <td className="font-medium whitespace-nowrap">{r.criterion}</td>
                            {r.levels.map((desc, i) => {
                              const val = 4 - i;
                              return (
                                <td key={val}>
                                  <label className="flex items-start gap-1.5 cursor-pointer text-xs">
                                    <input type="radio" name={r.key} value={val} required defaultChecked={defaults[r.key] === val} className="accent-black mt-0.5" />
                                    <span>{desc}</span>
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="field mt-3"><label className="label">تغذية راجعة</label><textarea name="feedback" className="textarea" rows={2} defaultValue={s.feedback ?? ""} /></div>
                  <SubmitButton className="btn-sm">{s.gradedAt ? "تحديث التقييم" : "اعتماد التقييم"}</SubmitButton>
                </form>
              </Card>
            );
          })}
        </div>
      )}

      <Card title="تعديل المهمة" className="mt-6">
        <form action={updateAssignment}>
          <input type="hidden" name="id" value={a.id} />
          <div className="field"><label className="label">العنوان</label><input name="title" className="input" required defaultValue={a.title} /></div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="field">
              <label className="label">الأسبوع</label>
              <select name="week" className="select" defaultValue={a.week}>
                {ACTIVE_WEEKS.map((w) => <option key={w.number} value={w.number}>{w.number === 0 ? "الافتتاحي" : `الأسبوع ${w.number}`}</option>)}
              </select>
            </div>
            <div className="field"><label className="label">موعد التسليم</label><input type="datetime-local" name="dueAt" className="input" required defaultValue={toLocalInput(a.dueAt)} /></div>
            <div className="field">
              <label className="label">الكفاءة</label>
              <select name="competency" className="select" defaultValue={a.competency ?? ""}>
                <option value="">—</option>
                {COMPETENCIES.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label className="label">الوصف</label><textarea name="description" className="textarea" defaultValue={a.description ?? ""} /></div>
          <div className="flex gap-2"><SubmitButton secondary>حفظ</SubmitButton></div>
        </form>
        <form action={deleteAssignment} className="mt-3">
          <input type="hidden" name="id" value={a.id} />
          <button className="btn btn-ghost btn-sm text-muted">حذف المهمة وتسليماتها</button>
        </form>
      </Card>
    </>
  );
}
