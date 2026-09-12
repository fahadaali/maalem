import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";
import CertificateSheet from "@/components/CertificateSheet";
import PrintButton from "@/components/PrintButton";
import { getCompletionLevels } from "@/lib/content";
import { activeCohort } from "@/lib/cohort";

export const metadata = { title: "وثيقة الإتمام" };

export default async function CertificatePage() {
  const user = await requireParticipantView();
  const [cert, cohort] = await Promise.all([db.certificate.findUnique({ where: { userId: user.id } }), activeCohort()]);
  return (
    <>
      <PageHeader title={cert?.kind === "ATTENDANCE" ? "إفادة الحضور" : "وثيقة الإتمام"} actions={cert ? <PrintButton label="طباعة الوثيقة" /> : undefined} />
      {cert ? (
        <CertificateSheet name={user.name} level={cert.level} total={cert.total} serial={cert.serial} issuedAt={cert.issuedAt} note={cert.note} kind={cert.kind} cohort={cohort?.name} />
      ) : (
        <>
          <Empty>لم تصدر وثيقتك بعد. تصدر في الحفل الختامي بعد اعتماد الدرجات النهائية.</Empty>
          <ul className="text-sm text-muted mt-4 space-y-1">
            {(await getCompletionLevels()).map((l, i, all) => (
              <li key={l.level}><span className="font-medium text-ink">{l.level}</span> ({l.min === 0 ? `أقل من ${all[i - 1]?.min ?? 60}` : `${l.min} فأكثر`}): {l.certificate}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
