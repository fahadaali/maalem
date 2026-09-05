import { requireRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import PushToggle from "@/components/PushToggle";
import InstallButton from "@/components/InstallButton";
import { changePassword } from "@/app/(auth)/actions";
import { pushEnabled } from "@/lib/notify";

export const metadata = { title: "الإعدادات" };

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const me = await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return (
    <>
      <PageHeader title="الإعدادات" subtitle={`${me.name} · ${me.username}`} />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card title="الإشعارات على جهازي"><PushToggle /></Card>
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
            <dt className="text-muted">إشعارات الدفع</dt><dd>{pushEnabled() ? "مفعّلة" : "غير مضبوطة — أضف مفاتيح VAPID في ملف البيئة"}</dd>
            <dt className="text-muted">التذكيرات المجدولة</dt><dd className="break-all" dir="ltr">GET {appUrl}/api/cron/reminders?key=…</dd>
          </dl>
          <p className="text-xs text-muted mt-2">اضبط مجدولاً خارجياً لاستدعاء نقطة التذكيرات مرة يومياً في الصباح (توقيت الرياض).</p>
        </Card>
      </div>
    </>
  );
}
