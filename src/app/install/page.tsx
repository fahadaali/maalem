import PublicNav from "@/components/PublicNav";
import { PageHeader, Card } from "@/components/ui";
import InstallButton from "@/components/InstallButton";

export const metadata = { title: "تثبيت التطبيق" };

export default function InstallPage() {
  return (
    <>
      <PublicNav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <PageHeader title="تثبيت التطبيق على جوالك" subtitle="المنصة تطبيق ويب تقدمي: يعمل من المتصفح، ويُثبَّت على الشاشة الرئيسية كأي تطبيق، ويستقبل الإشعارات." />
        <InstallButton />
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <Card title="آيفون / آيباد">
            <ol className="list-decimal ps-5 text-sm space-y-2">
              <li>افتح المنصة في متصفح
                <div dir="ltr" className="font-medium">Safari</div>
              </li>
              <li>اضغط زر المشاركة (المربع الذي يخرج منه سهم) أسفل الشاشة.</li>
              <li>اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</li>
              <li>افتح التطبيق من الشاشة الرئيسية، ثم من الإعدادات فعّل الإشعارات.</li>
            </ol>
            <p className="text-xs text-muted mt-3">الإشعارات على آيفون تعمل فقط بعد التثبيت على الشاشة الرئيسية (نظام 16.4 فأحدث).</p>
          </Card>
          <Card title="أندرويد">
            <ol className="list-decimal ps-5 text-sm space-y-2">
              <li>افتح المنصة في متصفح
                <div dir="ltr" className="font-medium">Chrome</div>
              </li>
              <li>اضغط زر «تثبيت التطبيق» أعلاه، أو من قائمة المتصفح اختر «تثبيت التطبيق» / «إضافة إلى الشاشة الرئيسية».</li>
              <li>افتح التطبيق، ثم من الإعدادات فعّل الإشعارات واسمح بها عند الطلب.</li>
            </ol>
          </Card>
        </div>
        <Card title="سطح المكتب" className="mt-4">
          <p className="text-sm">في المتصفحات الحديثة تظهر أيقونة تثبيت في شريط العنوان. بعد التثبيت يفتح التطبيق في نافذة مستقلة ويستقبل الإشعارات.</p>
        </Card>
      </main>
    </>
  );
}
