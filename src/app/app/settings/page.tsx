import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import PushToggle from "@/components/PushToggle";
import { vapidPublicKey } from "@/lib/notify";
import InstallButton from "@/components/InstallButton";
import { changePassword } from "@/app/(auth)/actions";
import Link from "next/link";

export const metadata = { title: "الإعدادات" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err } = await searchParams;
  const me = await db.user.findUnique({ where: { id: user.id }, include: { mentor: { select: { name: true } } } });
  return (
    <>
      <PageHeader title="الإعدادات" />
      <FormMessage ok={ok} err={err} />
      <div className="space-y-4">
        <Card title="حسابي">
          <dl className="text-sm grid grid-cols-[120px_1fr] gap-y-1">
            <dt className="text-muted">الاسم</dt><dd>{me?.name}</dd>
            <dt className="text-muted">اسم المستخدم</dt><dd dir="ltr" className="text-start">{me?.username}</dd>
            <dt className="text-muted">الجوال</dt><dd dir="ltr" className="text-start">{me?.phone ?? "—"}</dd>
            <dt className="text-muted">المشرف المرافق</dt><dd>{me?.mentor?.name ?? "لم يُحدد بعد"}</dd>
          </dl>
        </Card>
        <Card title="الإشعارات">
          <PushToggle publicKey={await vapidPublicKey()} />
        </Card>
        <Card title="تثبيت التطبيق">
          <InstallButton />
          <p className="text-xs text-muted mt-2"><Link href="/install" className="underline">دليل التثبيت للآيفون والأندرويد</Link></p>
        </Card>
        <Card title="تغيير كلمة المرور">
          <form action={changePassword}>
            <input type="hidden" name="back" value="/app/settings" />
            <div className="field"><label className="label">كلمة المرور الحالية</label><input type="password" name="current" className="input" required dir="ltr" autoComplete="current-password" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">الجديدة</label><input type="password" name="next" className="input" required dir="ltr" autoComplete="new-password" minLength={6} /></div>
              <div className="field"><label className="label">تأكيدها</label><input type="password" name="confirm" className="input" required dir="ltr" autoComplete="new-password" minLength={6} /></div>
            </div>
            <SubmitButton secondary>تغيير</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
