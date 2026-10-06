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
import { cohortWhere } from "@/lib/cohort";
import { extensionsFor } from "@/lib/deadlines";
import { loadParticipant } from "@/lib/participant-data";
import { openReturnFor } from "@/lib/returns";
import ReturnedBanner from "@/components/ReturnedBanner";

export const metadata = { title: "مهمة" };

export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { id } = await params;
  const { ok, err } = await searchParams;
  const a = await db.assignment.findFirst({ where: { id, ...(await cohortWhere()) }, include: { submissions: { where: { userId: user.id } } } });
  if (!a) notFound();
  const s = a.submissions[0];
  // تأجيل معتمد يمدّ موعد التسليم لصاحبه — ولا يقصّره إن جاء قبله
  const ext = (await extensionsFor(a.id, [user.id])).get(user.id);
  const dueAt = ext && ext > a.dueAt ? ext : a.dueAt;
  const extended = dueAt.getTime() !== a.dueAt.getTime();
  const [files, rows] = await Promise.all([listAttachments({ kind: "SUBMISSION", refId: a.id, userId: user.id }), loadParticipant(user.id)]);
  // المُرجَعة إليه تنفتح للتعديل ولو كانت مقيَّمة، وتقييمها السابق يبقى ظاهراً مرجعاً
  const returned = s ? openReturnFor(rows?.returns ?? [], "SUBMISSION", s.id) : undefined;
  const graded = !!s?.gradedAt && !returned;
  // التقييم السابق يُعرض ولو أُرجعت المهمة — مرجعاً لما يُعدَّل — والقفل لما لم يُرجَع وحده
  const scores = s?.gradedAt ? { completeness: s.completeness, referencing: s.referencing, application: s.application, punctuality: s.punctuality } : null;
  const total = scores ? Object.values(scores).reduce((x, y) => (x ?? 0) + (y ?? 0), 0) : null;

  return (
    <>
      <BackLink href="/app/tasks">مهامي</BackLink>
      <PageHeader title={a.title} subtitle={`الأسبوع ${a.week} · موعد التسليم ${formatDateTime(dueAt)}${extended ? " (مُدَّد لك)" : ""}${a.competency ? ` · ${a.competency}` : ""}`} />
      <FormMessage ok={ok} err={err} />
      {returned && <ReturnedBanner note={returned.note} by={returned.returnedBy} due={dueAt} />}
      {a.description && <div className="card card-muted text-sm mb-4 whitespace-pre-wrap">{a.description}</div>}
      {s?.gradedAt && (
        <Alert tone="success">
          <div className="font-medium mb-2">{returned ? "التقييم السابق قبل الإرجاع" : "نتيجة التقييم"}: {total} من 16</div>
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
          {!graded && <SubmitButton>{returned ? "أعد التسليم إلى مدير المشروع" : s ? "تحديث التسليم" : "تسليم"}</SubmitButton>}
          {s && <span className="text-xs text-muted ms-3">آخر تسليم: {formatDateTime(s.submittedAt)}</span>}
        </form>
      </Card>
    </>
  );
}
