import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Progress, Empty } from "@/components/ui";
import FormMessage from "@/components/FormMessage";
import FieldLogReview from "@/components/FieldLogReview";
import { withFiles } from "@/lib/attachments";

export const metadata = { title: "المشرف المرافق" };

export default async function MentorHome({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const me = await requireRole("MENTOR", "ADMIN");
  const { ok, err } = await searchParams;
  const where = me.role === "ADMIN" ? {} : { user: { mentorId: me.id } };
  const [mentees, pending, approved] = await Promise.all([
    db.user.findMany({ where: me.role === "ADMIN" ? { role: "PARTICIPANT", active: true } : { mentorId: me.id, active: true }, include: { fieldLogs: true }, orderBy: { name: "asc" } }),
    db.fieldLog.findMany({ where: { approvedAt: null, ...where }, include: { user: true }, orderBy: { date: "asc" } }),
    db.fieldLog.findMany({ where: { approvedAt: { not: null }, ...where }, include: { user: true }, orderBy: { approvedAt: "desc" }, take: 15 }),
  ]);
  return (
    <>
      <PageHeader title="المعايشة الميدانية — مجموعتي" subtitle="اعتمد سجلات المعايشة الأسبوعية للمشاركين المرافقين لك. المطلوب 12 ساعة موثقة لكل مشارك من الأسبوع 3 إلى 12." />
      <FormMessage ok={ok} err={err} />
      {mentees.length === 0 ? <Empty>لم يُربط بك مشاركون بعد. يعيّنهم مدير المشروع.</Empty> : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {mentees.map((m) => {
            const hours = m.fieldLogs.filter((l) => l.approvedAt).reduce((s, l) => s + l.hours, 0);
            return (
              <Card key={m.id}>
                <div className="font-medium mb-2">{m.name}</div>
                <Progress value={hours} max={12} label={`${hours} من 12 ساعة`} />
              </Card>
            );
          })}
        </div>
      )}
      <FieldLogReview pending={await withFiles(pending)} approved={approved} back="/mentor" />
    </>
  );
}
