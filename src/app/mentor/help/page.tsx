import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import Link from "@/components/Link";
import HelpList from "@/components/HelpList";
import { ensureHelpSeed, helpFor } from "@/lib/help";

export const metadata = { title: "المساعدة" };

/** المساعدة داخل منطقة الدور: بنوده وحدها، ولا يخرج صاحبها إلى الواجهة العامة */
export default async function HelpPage() {
  await requireRole("MENTOR");
  await ensureHelpSeed();
  const items = await helpFor("MENTOR");
  return (
    <>
      <PageHeader title="المساعدة" subtitle="دليل مختصر لاستعمال المنصة وتثبيتها على جوالك." />
      <HelpList items={items} />
      <p className="text-sm text-muted mt-4">
        لم تجد جوابك؟ راسل مدير المشروع. وإن كان الأمر عطلاً في المنصة فاذكر ما كنت تفعله والصفحة التي ظهر فيها ووقته، ويعينك{" "}
        <Link href="/help/device" className="underline">تشخيص الجهاز</Link>.
      </p>
    </>
  );
}
