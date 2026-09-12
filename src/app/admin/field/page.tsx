import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import FormMessage from "@/components/FormMessage";
import FieldLogReview from "@/components/FieldLogReview";
import { withFiles } from "@/lib/attachments";
import { participantsWhere } from "@/lib/cohort";
import { programExpectations } from "@/lib/content";

export const metadata = { title: "اعتماد المعايشة" };

export default async function AdminFieldPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const scope = { user: await participantsWhere() };
  const [pending, approved, expected] = await Promise.all([
    db.fieldLog.findMany({ where: { approvedAt: null, ...scope }, include: { user: true }, orderBy: { date: "asc" } }),
    db.fieldLog.findMany({ where: { approvedAt: { not: null }, ...scope }, include: { user: true }, orderBy: { approvedAt: "desc" }, take: 20 }),
    programExpectations(),
  ]);
  return (
    <>
      <PageHeader title="اعتماد سجلات المعايشة الميدانية" subtitle={`يعتمد المشرف المرافق أو مدير المشروع كل سجل. المطلوب ${expected.fieldHours} ساعة موثقة لكل مشارك.`} />
      <FormMessage ok={ok} err={err} />
      <FieldLogReview pending={await withFiles(pending)} approved={approved} back="/admin/field" />
    </>
  );
}
