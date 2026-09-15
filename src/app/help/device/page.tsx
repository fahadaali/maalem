import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import DeviceReport from "./DeviceReport";

export const metadata = { title: "تشخيص الجهاز", robots: { index: false, follow: false } };

/**
 * صفحة تشخيص: تعرض ما يقوله الجهاز عن نفسه وأي وسوم شاشة الإقلاع تطابقه.
 * خلف الجلسة: لا تعرض من بيانات المنصة شيئاً، لكنها تكشف عن الجهاز ما لا داعي
 * لأن يُقرأ من خارجها، ولا يحتاجها إلا من دخل فوقع له عطل.
 */
export default async function DevicePage() {
  await requireUser();
  return (
    <main className="max-w-2xl mx-auto p-5">
      <PageHeader title="تشخيص الجهاز" subtitle="ما يقوله جهازك عن نفسه. تُفتح من داخل التطبيق المثبَّت ليصحّ القياس." />
      <DeviceReport />
    </main>
  );
}
