import { requireRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import PushToggle from "@/components/PushToggle";
import { vapidPublicKey } from "@/lib/notify";
import InstallButton from "@/components/InstallButton";
import { changePassword } from "@/app/(auth)/actions";

export const metadata = { title: "الإعدادات" };

export default async function MentorSettings({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const me = await requireRole("MENTOR", "ADMIN");
  const { ok, err } = await searchParams;
  return (
    <>
      <PageHeader title="الإعدادات" subtitle={`${me.name} · ${me.username}`} />
      <FormMessage ok={ok} err={err} />
      <div className="space-y-4">
        <Card title="الإشعارات"><PushToggle publicKey={vapidPublicKey()} /></Card>
        <Card title="تثبيت التطبيق"><InstallButton /></Card>
        <Card title="تغيير كلمة المرور">
          <form action={changePassword}>
            <input type="hidden" name="back" value="/mentor/settings" />
            <div className="field"><label className="label">الحالية</label><input type="password" name="current" className="input" required dir="ltr" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">الجديدة</label><input type="password" name="next" className="input" required dir="ltr" minLength={6} /></div>
              <div className="field"><label className="label">تأكيدها</label><input type="password" name="confirm" className="input" required dir="ltr" minLength={6} /></div>
            </div>
            <SubmitButton secondary>تغيير</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
