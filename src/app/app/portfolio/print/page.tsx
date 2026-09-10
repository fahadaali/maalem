import Link from "next/link";
import { requireParticipantView } from "@/lib/auth";
import PortfolioSheet from "@/components/PortfolioSheet";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "ملف الإنجاز — طباعة" };

export default async function PortfolioPrintPage() {
  const user = await requireParticipantView();
  return (
    <>
      <div className="no-print mb-4 flex gap-2">
        <PrintButton label="طباعة ملف الإنجاز" />
        <Link href="/app/portfolio" className="btn btn-ghost btn-sm">رجوع</Link>
      </div>
      <PortfolioSheet userId={user.id} includePrivate />
    </>
  );
}
