import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import PortfolioSheet from "@/components/PortfolioSheet";
import PrintButton from "@/components/PrintButton";
import { Alert } from "@/components/ui";
import { formatShort } from "@/lib/dates";

export const metadata = { title: "ملف إنجاز مشارك" };

export default async function AdminPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: { name: true, role: true, portfolioSubmittedAt: true } });
  if (!u || u.role !== "PARTICIPANT") notFound();
  return (
    <>
      <div className="no-print mb-4 flex gap-2 items-center">
        <PrintButton label="طباعة الملف" />
        <Link href={`/admin/participants/${id}`} className="btn btn-ghost btn-sm">رجوع لملف {u.name}</Link>
      </div>
      <div className="no-print">
        {u.portfolioSubmittedAt ? (
          <Alert tone="success">سلّم المشارك ملف إنجازه في {formatShort(u.portfolioSubmittedAt)}.</Alert>
        ) : (
          <Alert>لم يسلّم المشارك ملفه النهائي بعد. ما يظهر أدناه هو ما رصدته المنصة، دون دفتر تأمله الشخصي.</Alert>
        )}
      </div>
      <PortfolioSheet userId={id} includePrivate={!!u.portfolioSubmittedAt} />
    </>
  );
}
