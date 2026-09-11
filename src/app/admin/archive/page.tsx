import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import { Download } from "lucide-react";
import { formatShort } from "@/lib/dates";
import { cohortWhere } from "@/lib/cohort";

export const metadata = { title: "الأرشفة والتصدير" };

const EXPORTS = [
  { kind: "grades", label: "كشف الدرجات", hint: "مكوّنات التقييم والمجموع والمستوى" },
  { kind: "attendance", label: "سجل الحضور", hint: "الحضوري وعن بُعد لكل أسبوع" },
  { kind: "tasks", label: "المهام وتقييمها", hint: "التسليمات وسلم التقدير والتغذية الراجعة" },
  { kind: "reports", label: "التقارير الأسبوعية", hint: "نص التقارير كاملاً" },
  { kind: "reading", label: "بطاقات القراءة", hint: "الكتب والصفحات والفوائد" },
  { kind: "field", label: "سجل المعايشة", hint: "الساعات والمشرفون المرافقون والاعتماد" },
];

export default async function ArchivePage() {
  await requireRole("ADMIN");
  const participants = await db.user.findMany({
    where: { role: "PARTICIPANT", ...(await cohortWhere()) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, portfolioSubmittedAt: true, certificate: { select: { serial: true } } },
  });

  return (
    <>
      <PageHeader
        title="الأرشفة والتصدير"
        subtitle="أرشفة ملفات الإنجاز بند في مرحلة الإغلاق. صدّر البيانات جداول، واطبع ملف كل مشارك."
      />
      <Card title="تصدير جداول" className="mb-4">
        <ul className="divide-y divide-line">
          {EXPORTS.map((e) => (
            <li key={e.kind} className="py-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{e.label}</div>
                <div className="text-xs text-muted">{e.hint}</div>
              </div>
              <a href={`/api/export/${e.kind}`} className="btn btn-secondary btn-sm shrink-0">
                <Download size={14} /> تنزيل
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted mt-3">الملفات بصيغة CSV بترميز يدعم العربية، تفتحها برامج الجداول مباشرة.</p>
      </Card>

      <Card title="ملفات الإنجاز">
        {participants.length === 0 ? (
          <Empty>لا مشاركون.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {participants.map((p) => (
              <li key={p.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted">
                    {p.portfolioSubmittedAt ? `سُلّم في ${formatShort(p.portfolioSubmittedAt)}` : "لم يُسلَّم بعد"}
                    {p.certificate ? ` · وثيقة ${p.certificate.serial}` : ""}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {p.portfolioSubmittedAt ? <Badge tone="ink">مسلَّم</Badge> : <Badge tone="soft">معلّق</Badge>}
                  <Link href={`/admin/participants/${p.id}/portfolio`} className="btn btn-secondary btn-sm">عرض وطباعة</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
