import { notFound } from "next/navigation";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, BackLink, Alert } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { submitAssignment } from "../../actions";
import { formatDateTime } from "@/lib/dates";
import { TASK_RUBRIC } from "@/lib/program";
import Attachments from "@/components/Attachments";
import { listAttachments } from "@/lib/attachments";

export const metadata = { title: "مهمة" };

export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { id } = await params;
  const { ok, err } = await searchParams;
  const a = await db.assignment.findUnique({ where: { id }, include: { submissions: { where: { userId: user.id } } } });
  if (!a) notFound();
  const s = a.submissions[0];
  const files = await listAttachments({ kind: "SUBMISSION", refId: a.id, userId: user.id });
  const graded = !!s?.gradedAt;
  const scores = graded ? { completeness: s!.completeness, referencing: s!.referencing, application: s!.application, punctuality: s!.punctuality } : null;
  const total = scores ? Object.values(scores).reduce((x, y) => (x ?? 0) + (y ?? 0), 0) : null;

  return (
    <>
      <BackLink href="/app/tasks">المهام</BackLink>
      <PageHeader title={a.title} subtitle={`الأسبوع ${a.week} · موعد التسليم ${formatDateTime(a.dueAt)}${a.competency ? ` · ${a.competency}` : ""}`} />
      <FormMessage ok={ok} err={err} />
      {a.description && <div className="card card-muted text-sm mb-4 whitespace-pre-wrap">{a.description}</div>}
      {graded && (
        <Alert tone="success">
          <div className="font-medium mb-2">نتيجة التقييم: {total} من 16</div>
          <ul className="text-sm space-y-0.5">
            {TASK_RUBRIC.map((r) => (
              <li key={r.key}>{r.criterion}: {scores![r.key]} — {r.levels[4 - (scores![r.key] ?? 1)]}</li>
            ))}
          </ul>
          {s!.feedback && <div className="mt-2 whitespace-pre-wrap">{s!.feedback}</div>}
        </Alert>
      )}
      <Card title={s ? "تسليمي" : "تسليم المهمة"}>
        <form action={submitAssignment}>
          <input type="hidden" name="assignmentId" value={a.id} />
          <div className="field">
            <label className="label">وصف ما أنجزته</label>
            <textarea name="content" className="textarea" rows={6} defaultValue={s?.content ?? ""} required disabled={graded} />
          </div>
          <div className="field">
            <label className="label">رابط الملف في المساحة المشتركة (اختياري)</label>
            <input name="link" className="input" dir="ltr" placeholder="https://" defaultValue={s?.link ?? ""} disabled={graded} />
          </div>
          <div className="field">
            <label className="label">المرفقات (الشاهد)</label>
            <Attachments kind="SUBMISSION" refId={a.id} initial={files} readOnly={graded} />
          </div>
          {!graded && <SubmitButton>{s ? "تحديث التسليم" : "تسليم"}</SubmitButton>}
          {s && <span className="text-xs text-muted ms-3">آخر تسليم: {formatDateTime(s.submittedAt)}</span>}
        </form>
      </Card>
    </>
  );
}
