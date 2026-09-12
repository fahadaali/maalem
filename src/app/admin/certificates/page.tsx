import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import CertificateSheet from "@/components/CertificateSheet";
import PrintButton from "@/components/PrintButton";
import { issueCertificate, revokeCertificate } from "../actions";
import { computeGradesFor } from "@/lib/grades";
import { formatShort } from "@/lib/dates";
import { participantsWhere } from "@/lib/cohort";
import { finalTotalOf, getCompletionLevels, levelOf } from "@/lib/content";
import { activeCohort } from "@/lib/cohort";

export const metadata = { title: "وثائق الإتمام" };

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; print?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const participants = await db.user.findMany({ where: await participantsWhere(), orderBy: { name: "asc" }, include: { certificate: true } });
  const grades = await computeGradesFor(participants.map((p) => p.id));
  const finals = await db.finalGrade.findMany({ where: { userId: { in: participants.map((x) => x.id) } } });
  const levels = await getCompletionLevels();
  const cohort = await activeCohort();
  // النصوص من مستويات الإتمام القابلة للتعديل، لا من أرقام ثابتة قد تخالفها
  const passing = levels.filter((l) => l.min > 0).map((l) => l.min);
  const minPass = passing.length ? Math.min(...passing) : 60;
  const conditional = [...levels].sort((a, b) => a.min - b.min).find((l) => l.min === minPass);
  const above = [...levels].sort((a, b) => a.min - b.min).find((l) => l.min > minPass);

  if (sp.print) {
    const issued = participants.filter((p) => p.certificate);
    return (
      <div>
        <div className="no-print mb-4 flex gap-2"><PrintButton label="طباعة الوثائق" /></div>
        {issued.length === 0 ? <Empty>لا وثائق صادرة.</Empty> : issued.map((p, i) => (
          <div key={p.id} className={i > 0 ? "mt-10 break-before-page" : ""}>
            <CertificateSheet name={p.name} level={p.certificate!.level} total={p.certificate!.total} serial={p.certificate!.serial} issuedAt={p.certificate!.issuedAt} note={p.certificate!.note} kind={p.certificate!.kind} cohort={cohort?.name} max={grades[i]?.maxes.continuous + grades[i]?.maxes.project} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="وثائق الإتمام"
        subtitle={`تُصدر في الحفل الختامي من الدرجة المعتمدة إن وُجدت. من نال ${minPass} فأكثر يُمنح وثيقة إتمام، ومن دونها يُمنح إفادة حضور تلقائياً.`}
        actions={<a href="/admin/certificates?print=1" className="btn btn-secondary btn-sm">طباعة الصادر</a>}
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      {participants.length === 0 ? (
        <Empty>لا مشاركون.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>المشارك</th><th>المجموع</th><th>الاعتماد</th><th>المستوى</th><th>الوثيقة</th><th>ملاحظة على الوثيقة</th><th></th></tr></thead>
            <tbody>
              {participants.map((p, i) => {
                const g = grades[i];
                const c = p.certificate;
                const f = finals.find((x) => x.userId === p.id);
                return (
                  <tr key={p.id}>
                    <td className="font-medium whitespace-nowrap">{p.name}</td>
                    <td>{f ? finalTotalOf(f) : g.total}</td>
                    <td>{f ? <Badge tone="ink">معتمدة</Badge> : <Badge tone="soft">غير معتمدة</Badge>}</td>
                    <td>{f ? levelOf(levels, finalTotalOf(f)).level : g.level}</td>
                    <td className="whitespace-nowrap">
                      {c ? <><Badge tone="ink">{c.kind === "ATTENDANCE" ? "إفادة حضور" : "وثيقة إتمام"}</Badge><div className="text-xs text-muted mt-1" dir="ltr">{c.serial}</div><div className="text-xs text-muted">{formatShort(c.issuedAt)}</div></> : <Badge tone="soft">لم تصدر</Badge>}
                    </td>
                    <td>
                      <form action={issueCertificate} className="flex gap-1 items-center">
                        <input type="hidden" name="userId" value={p.id} />
                        <input name="note" className="input" defaultValue={c?.note ?? ""} placeholder="اختياري" />
                        <SubmitButton className="btn-sm" pendingText="…">{c ? "تحديث" : "إصدار"}</SubmitButton>
                      </form>
                    </td>
                    <td>
                      {c && (
                        <form action={revokeCertificate}>
                          <input type="hidden" name="userId" value={p.id} />
                          <button className="btn btn-ghost btn-sm text-muted">سحب</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Card title="تنبيه" className="mt-4">
        <p className="text-sm text-muted">
          {conditional ? `«${conditional.level}» (${conditional.min}${above ? `–${above.min - 1}` : " فأكثر"}): ${conditional.certificate}` : ""} ومن نال أقل من {minPass} يُمنح إفادة حضور لا وثيقة إتمام.
        </p>
      </Card>
    </>
  );
}
