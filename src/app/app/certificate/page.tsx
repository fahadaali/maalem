import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";
import CertificateSheet from "@/components/CertificateSheet";
import PrintButton from "@/components/PrintButton";
import { COMPLETION_LEVELS } from "@/lib/program";

export const metadata = { title: "وثيقة الإتمام" };

export default async function CertificatePage() {
  const user = await requireParticipantView();
  const cert = await db.certificate.findUnique({ where: { userId: user.id } });
  return (
    <>
      <PageHeader title="وثيقة الإتمام" actions={cert ? <PrintButton label="طباعة الوثيقة" /> : undefined} />
      {cert ? (
        <CertificateSheet name={user.name} level={cert.level} total={cert.total} serial={cert.serial} issuedAt={cert.issuedAt} note={cert.note} />
      ) : (
        <>
          <Empty>لم تصدر وثيقتك بعد. تصدر في الحفل الختامي بعد اعتماد الدرجات النهائية.</Empty>
          <ul className="text-sm text-muted mt-4 space-y-1">
            {COMPLETION_LEVELS.map((l) => (
              <li key={l.level}><span className="font-medium text-ink">{l.level}</span> ({l.min === 0 ? "أقل من 60" : `${l.min} فأكثر`}): {l.certificate}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
