import { requireRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import PushToggle from "@/components/PushToggle";
import InstallButton from "@/components/InstallButton";
import { changePassword } from "@/app/(auth)/actions";
import { startPreview } from "../actions";
import { Eye } from "lucide-react";
import { pushEnabled, vapidPublicKey } from "@/lib/notify";
import { getCronSecret } from "@/lib/secrets";
import { headers } from "next/headers";

export const metadata = { title: "الإعدادات" };

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const me = await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? (h.get("host")?.startsWith("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL || `${proto}://${h.get("host") ?? "localhost"}`;
  const cronKey = await getCronSecret();
  return (
    <>
      <PageHeader title="الإعدادات" subtitle={`${me.name} · ${me.username}`} />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card title="معاينة تجربة المشارك">
          <p className="text-sm text-muted mb-3">
            تصفّح واجهة المشارك كما يراها — بحسابك أنت وللقراءة فقط. تظهر لك المهام والاختبارات ومحتوى أسبوع البرنامج،
            ولا تظهر سجلات أي مشارك آخر، ولا يُحفظ أي تغيير. للخروج زر في أعلى الشاشة.
          </p>
          <form action={startPreview}>
            <SubmitButton secondary pendingText="جارٍ الفتح…"><Eye size={16} /> فتح المعاينة</SubmitButton>
          </form>
        </Card>
        <Card title="الإشعارات على جهازي"><PushToggle publicKey={await vapidPublicKey()} /></Card>
        <Card title="تثبيت التطبيق"><InstallButton /></Card>
        <Card title="تغيير كلمة المرور">
          <form action={changePassword}>
            <input type="hidden" name="back" value="/admin/settings" />
            <div className="field"><label className="label">الحالية</label><input type="password" name="current" className="input" required dir="ltr" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">الجديدة</label><input type="password" name="next" className="input" required dir="ltr" minLength={6} /></div>
              <div className="field"><label className="label">تأكيدها</label><input type="password" name="confirm" className="input" required dir="ltr" minLength={6} /></div>
            </div>
            <SubmitButton secondary>تغيير</SubmitButton>
          </form>
        </Card>
        <Card title="حالة الخادم">
          <dl className="text-sm grid grid-cols-[160px_1fr] gap-y-1">
            <dt className="text-muted">إشعارات الدفع</dt><dd>{(await pushEnabled()) ? "مفعّلة (مفاتيح مولَّدة تلقائياً)" : "غير متاحة"}</dd>
            <dt className="text-muted">الأسرار</dt><dd>مولَّدة تلقائياً ومحفوظة في قاعدة البيانات</dd>
            <dt className="text-muted">التذكيرات المجدولة</dt><dd>تعمل يومياً 07:00 بتوقيت الرياض من مشغّل Cron</dd>
          </dl>
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer">تشغيل التذكيرات يدوياً</summary>
            <code className="block mt-1 break-all" dir="ltr">{appUrl}/api/cron/reminders?key={cronKey}</code>
          </details>
        </Card>
      </div>
    </>
  );
}
