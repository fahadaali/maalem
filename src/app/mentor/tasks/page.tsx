import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import Attachments from "@/components/Attachments";
import { mentorGradeSubmission } from "../actions";
import { RUBRIC_LEVEL_LABELS, TASK_RUBRIC } from "@/lib/program";
import { formatDateTime } from "@/lib/dates";
import { cohortWhere } from "@/lib/cohort";
import { withFiles } from "@/lib/attachments";
import { cn } from "@/lib/utils";

export const metadata = { title: "تقييم مهام مجموعتي" };

export default async function MentorTasksPage({ searchParams }: { searchParams: Promise<{ a?: string; ok?: string; err?: string }> }) {
  const me = await requireRole("MENTOR");
  const sp = await searchParams;
  const [assignments, mentees] = await Promise.all([
    db.assignment.findMany({ where: await cohortWhere(), orderBy: { week: "asc" }, select: { id: true, title: true, week: true } }),
    db.user.findMany({ where: { mentorId: me.id, active: true }, select: { id: true, name: true } }),
  ]);
  const ids = mentees.map((m) => m.id);
  const selected = assignments.find((a) => a.id === sp.a) ?? assignments[0];
  const rows = selected
    ? await withFiles(
        await db.submission.findMany({
          where: { assignmentId: selected.id, userId: { in: ids } },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { submittedAt: "asc" },
        }),
      )
    : [];

  return (
    <>
      <PageHeader
        title="تقييم مهام مجموعتي"
        subtitle="تقيّم بسلّم التقدير نفسه، ولمن رُبطوا بك وحدهم. لا تُنشئ مهمة ولا تعدّلها — ذلك لمدير المشروع."
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      {mentees.length === 0 ? (
        <Empty>لم يُربط بك مشاركون بعد.</Empty>
      ) : assignments.length === 0 ? (
        <Empty>لا مهام في البرنامج بعد.</Empty>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
            {assignments.map((a) => (
              <Link key={a.id} href={`/mentor/tasks?a=${a.id}`} className={cn("badge shrink-0", a.id === selected?.id && "badge-ink")}>
                الأسبوع {a.week}: {a.title}
              </Link>
            ))}
          </div>
          {rows.length === 0 ? (
            <Empty>لا تسليمات من مجموعتك على هذه المهمة.</Empty>
          ) : (
            <div className="space-y-4">
              {rows.map((s) => {
                const defaults: Record<string, number | null> = { completeness: s.completeness, referencing: s.referencing, application: s.application, punctuality: s.punctuality };
                return (
                  <Card
                    key={s.id}
                    title={<Link href={`/mentor/participants/${s.userId}`} className="hover:underline">{s.user.name}</Link>}
                    action={s.gradedAt ? <Badge tone="ink">مقيَّمة</Badge> : <Badge>بانتظار التقييم</Badge>}
                  >
                    <div className="text-xs text-muted mb-2">سُلّمت {formatDateTime(s.submittedAt)}</div>
                    <p className="text-sm whitespace-pre-wrap">{s.content}</p>
                    {s.link && <p className="text-sm mt-1"><a href={s.link} className="underline" target="_blank" rel="noreferrer" dir="ltr">{s.link}</a></p>}
                    <div className="mt-2"><Attachments kind="SUBMISSION" refId={s.assignmentId} initial={s.files} readOnly /></div>
                    <form action={mentorGradeSubmission} className="border-t border-line pt-3 mt-3">
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
        </>
      )}
    </>
  );
}
