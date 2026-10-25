import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import FormMessage from "@/components/FormMessage";
import Attachments from "@/components/Attachments";
import { mentorGradeSubmission } from "../actions";
import RubricGradeForm from "@/components/RubricGradeForm";
import { extensionsFor } from "@/lib/deadlines";
import { getWeeks, pauseOf } from "@/lib/weeks";
import { formatDateTime } from "@/lib/dates";
import { cohortWhere } from "@/lib/cohort";
import { attachmentsByUser } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import { openReturnsOf } from "@/lib/items";

export const metadata = { title: "تقييم مهام مجموعتي" };

export default async function MentorTasksPage({ searchParams }: { searchParams: Promise<{ a?: string; ok?: string; err?: string }> }) {
  const me = await requireRole("MENTOR");
  const sp = await searchParams;
  const [assignments, mentees] = await Promise.all([
    db.assignment.findMany({ where: await cohortWhere(), orderBy: { week: "asc" }, select: { id: true, title: true, week: true, dueAt: true } }),
    db.user.findMany({ where: { mentorId: me.id, active: true }, select: { id: true, name: true } }),
  ]);
  const ids = mentees.map((m) => m.id);
  const selected = assignments.find((a) => a.id === sp.a) ?? assignments[0];
  const rows = selected
    ? await db.submission.findMany({
        where: { assignmentId: selected.id, userId: { in: ids } },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { submittedAt: "asc" },
      })
    : [];
  const filesByUser = selected ? await attachmentsByUser("SUBMISSION", selected.id) : new Map();
  const returned = await openReturnsOf("SUBMISSION", rows.map((s) => s.id));
  // الموعد الساري بالتمديد المعتمد، وأيام الإيقاف — منهما يُقترح «الالتزام بالموعد» كما في لوحة المدير
  const [extensions, weeks] = await Promise.all([selected ? extensionsFor(selected.id, ids) : new Map<string, Date>(), getWeeks()]);
  const pause = pauseOf(weeks);
  /** الأبعد من موعد المهمة وتمديد صاحبها، كما في `dueFor` */
  const dueOf = (userId: string): Date => {
    const e = extensions.get(userId);
    return selected && e && e > selected.dueAt ? e : (selected?.dueAt ?? new Date());
  };

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
                return (
                  <Card
                    key={s.id}
                    title={<Link href={`/mentor/participants/${s.userId}`} className="hover:underline">{s.user.name}</Link>}
                    action={returned.has(s.id) ? <Badge>مُرجَع لصاحبه</Badge> : s.gradedAt ? <Badge tone="ink">مقيَّمة</Badge> : <Badge>بانتظار التقييم</Badge>}
                  >
                    <div className="text-xs text-muted mb-2">سُلّمت {formatDateTime(s.submittedAt)}</div>
                    <p className="text-sm whitespace-pre-wrap">{s.content}</p>
                    {s.link && <p className="text-sm mt-1"><a href={s.link} className="underline" target="_blank" rel="noreferrer" dir="ltr">{s.link}</a></p>}
                    <div className="mt-2"><Attachments kind="SUBMISSION" refId={s.assignmentId} initial={filesByUser.get(s.userId) ?? []} readOnly /></div>
                    <RubricGradeForm action={mentorGradeSubmission} s={s} due={dueOf(s.userId)} pause={pause} returned={returned.has(s.id)} />
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
