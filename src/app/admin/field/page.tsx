import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import FormMessage from "@/components/FormMessage";
import FieldLogReview from "@/components/FieldLogReview";

export const metadata = { title: "اعتماد المعايشة" };

export default async function AdminFieldPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const [pending, approved] = await Promise.all([
    db.fieldLog.findMany({ where: { approvedAt: null }, include: { user: true }, orderBy: { date: "asc" } }),
    db.fieldLog.findMany({ where: { approvedAt: { not: null } }, include: { user: true }, orderBy: { approvedAt: "desc" }, take: 20 }),
  ]);
  return (
    <>
      <PageHeader title="اعتماد سجلات المعايشة الميدانية" subtitle="يعتمد المشرف المرافق أو مدير المشروع كل سجل. المطلوب 12 ساعة موثقة لكل مشارك." />
      <FormMessage ok={ok} err={err} />
      <FieldLogReview pending={pending} approved={approved} back="/admin/field" />
    </>
  );
}
