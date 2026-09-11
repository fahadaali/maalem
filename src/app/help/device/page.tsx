import { PageHeader } from "@/components/ui";
import DeviceReport from "./DeviceReport";

export const metadata = { title: "تشخيص الجهاز" };

/**
 * صفحة تشخيص: تعرض ما يقوله الجهاز عن نفسه وأي وسوم شاشة الإقلاع تطابقه.
 * عامة بلا تسجيل دخول لأنها لا تعرض من بيانات المنصة شيئاً.
 */
export default function DevicePage() {
  return (
    <main className="max-w-2xl mx-auto p-5">
      <PageHeader title="تشخيص الجهاز" subtitle="ما يقوله جهازك عن نفسه. تُفتح من داخل التطبيق المثبَّت ليصحّ القياس." />
      <DeviceReport />
    </main>
  );
}
