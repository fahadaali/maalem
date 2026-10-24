import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Progress, Empty } from "@/components/ui";
import FormMessage from "@/components/FormMessage";
import FieldLogReview from "@/components/FieldLogReview";
import { openReturnsOf } from "@/lib/items";
import MentorEvalForm from "@/components/MentorEvalForm";
import { withFiles } from "@/lib/attachments";
import { programExpectations } from "@/lib/content";
import { loadParticipantsOnce, loadProgram } from "@/lib/participant-data";
import { progressFrom } from "@/lib/progress";

export const metadata = { title: "المشرف المرافق" };

export default async function MentorHome({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const me = await requireRole("MENTOR");
  const { ok, err } = await searchParams;
  const where = { user: { mentorId: me.id } };
  const [mentees, pending, approved, expected] = await Promise.all([
    db.user.findMany({ where: { mentorId: me.id, active: true }, include: { mentorEvaluations: true }, orderBy: { name: "asc" } }),
    db.fieldLog.findMany({ where: { approvedAt: null, ...where }, include: { user: true }, orderBy: { date: "asc" } }),
    db.fieldLog.findMany({ where: { approvedAt: { not: null }, ...where }, include: { user: true }, orderBy: { approvedAt: "desc" }, take: 15 }),
    programExpectations(),
  ]);
  // الساعات المعتمدة من المستحق حتى الآن، بقواعد «مهامي» نفسها: المُرجَع لا يُحسب حتى يُعاد
  const [menteeRows, program] = await Promise.all([loadParticipantsOnce(mentees.map((m) => m.id)), loadProgram()]);
  const now = new Date();
  const fieldOf = (id: string) => {
    const r = menteeRows.get(id);
    return r ? progressFrom(r, program, now).field : null;
  };
  return (
    <>
      <PageHeader title="المعايشة الميدانية — مجموعتي" subtitle={`اعتمد سجلات المعايشة الأسبوعية للمشاركين المرافقين لك. المطلوب ${expected.fieldHours} ساعة موثقة لكل مشارك من الأسبوع 3 إلى 12.`} />
      <FormMessage ok={ok} err={err} />
      {mentees.length === 0 ? <Empty>لم يُربط بك مشاركون بعد. يعيّنهم مدير المشروع.</Empty> : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {mentees.map((m) => {
            const f = fieldOf(m.id);
            return (
              <Card key={m.id}>
                <div className="font-medium mb-2"><Link href={`/mentor/participants/${m.id}`} className="hover:underline">{m.name}</Link></div>
                {f && f.due > 0 ? (
                  <Progress value={Math.min(f.done, f.due)} max={f.due} label={`${f.done} من ${f.due} ساعة مستحقة${f.pending ? ` · ${f.pending} بانتظار اعتمادك` : ""}`} />
                ) : (
                  <p className="text-xs text-muted">لم تُستحقّ ساعات بعد · {f?.done ?? 0} معتمدة{f?.pending ? ` · ${f.pending} بانتظار اعتمادك` : ""}</p>
                )}
                <div className="text-[11px] text-muted mt-1">المطلوب في البرنامج كله {f?.total ?? expected.fieldHours} ساعة</div>
              </Card>
            );
          })}
        </div>
      )}
      {mentees.length > 0 && (
        <div className="space-y-4 mb-8">
          <h2 className="text-xl">تقييم المعايشة الميدانية</h2>
          {mentees.map((m) => (
            <MentorEvalForm key={m.id} userId={m.id} name={m.name} existing={m.mentorEvaluations} />
          ))}
        </div>
      )}

      <h2 className="text-xl mb-2">سجلات المعايشة</h2>
      <FieldLogReview pending={await withFiles(pending)} approved={approved} back="/mentor" returned={new Set((await openReturnsOf("FIELD_LOG", [...pending, ...approved].map((l) => l.id))).keys())} />
    </>
  );
}
