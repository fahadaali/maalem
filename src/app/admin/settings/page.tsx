import { requireRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import PushToggle from "@/components/PushToggle";
import InstallButton from "@/components/InstallButton";
import ThemeToggle from "@/components/ThemeToggle";
import { changePassword } from "@/app/(auth)/actions";
import { startPreview, saveEmailSettings, disableEmail, sendTestEmail } from "../actions";
import { Eye } from "lucide-react";
import { pushEnabled, vapidPublicKey } from "@/lib/notify";
import { getCronSecret } from "@/lib/secrets";
import { emailConfig } from "@/lib/email";
import { headers } from "next/headers";
import ContactCards from "@/components/ContactCards";

export const metadata = { title: "الإعدادات" };

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const me = await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? (h.get("host")?.startsWith("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL || `${proto}://${h.get("host") ?? "localhost"}`;
  const cronKey = await getCronSecret();
  const mail = await emailConfig();
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
        <ContactCards userId={me.id} back="/admin/settings" />
        <Card title="مظهر الواجهة">
          <p className="text-sm text-muted mb-3">الوضع الليلي يريح العين في القراءة المسائية. «حسب الجهاز» يتبع إعداد جوالك تلقائياً.</p>
          <ThemeToggle />
        </Card>
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
        <Card title="قناة البريد الإلكتروني الاحتياطية">
          <p className="text-sm text-muted mb-3">
            قناة ثانية للتنبيهات: من لم يفعّل إشعارات جهازه — أو أوقفها — يصله التنبيه على بريده.
            المنصة تعمل بدونها، وتفعيلها يحتاج مفتاحاً من مزوّد بريد ونطاقاً موثّقاً لديه.
          </p>
          <form action={saveEmailSettings}>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">المزوّد</label>
                <select name="provider" className="select" defaultValue={mail?.provider ?? "resend"}>
                  <option value="resend">Resend</option>
                  <option value="brevo">Brevo</option>
                </select>
              </div>
              <div className="field">
                <label className="label">المفتاح {mail ? "(محفوظ — اتركه فارغاً لإبقائه)" : ""}</label>
                <input name="apiKey" className="input" dir="ltr" type="password" placeholder={mail ? "••••••••" : ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">بريد المُرسل</label><input name="from" className="input" dir="ltr" defaultValue={mail?.from ?? ""} placeholder="no-reply@example.com" /></div>
              <div className="field"><label className="label">اسم المُرسل</label><input name="fromName" className="input" defaultValue={mail?.fromName ?? "معالم التربية"} /></div>
            </div>
            <SubmitButton secondary>حفظ</SubmitButton>
          </form>
          {mail && (
            <div className="border-t border-line mt-3 pt-3 space-y-3">
              <form action={sendTestEmail} className="flex flex-wrap items-end gap-2">
                <div className="grow"><label className="label">تجربة الإرسال</label><input name="to" className="input" dir="ltr" placeholder="you@example.com" required type="email" /></div>
                <SubmitButton secondary className="btn-sm" pendingText="جارٍ الإرسال…">إرسال رسالة تجريبية</SubmitButton>
              </form>
              <form action={disableEmail}>
                <SubmitButton ghost className="btn-sm !px-0" pendingText="…">إيقاف قناة البريد وحذف المفتاح</SubmitButton>
              </form>
            </div>
          )}
        </Card>
        <Card title="حالة الخادم">
          <dl className="text-sm grid grid-cols-[160px_1fr] gap-y-1">
            <dt className="text-muted">إشعارات الدفع</dt><dd>{(await pushEnabled()) ? "مفعّلة (مفاتيح مولَّدة تلقائياً)" : "غير متاحة"}</dd>
            <dt className="text-muted">الأسرار</dt><dd>مولَّدة تلقائياً ومحفوظة في قاعدة البيانات</dd>
            <dt className="text-muted">التذكيرات الثابتة</dt><dd>تعمل يومياً 07:00 بتوقيت الرياض من مشغّل Cron</dd>
            <dt className="text-muted">التذكيرات المخصصة</dt><dd>تُفحص كل ساعة وتُرسل في موعدها</dd>
            <dt className="text-muted">قناة البريد</dt><dd>{mail ? `مفعّلة عبر ${mail.provider}` : "غير مفعّلة (اختيارية)"}</dd>
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
