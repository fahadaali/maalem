import Link from "next/link";
import { redirect } from "next/navigation";
import { needsSetup, schemaReady } from "@/lib/setup";
import { runSetup } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { storageBackend } from "@/lib/storage";

export const metadata = { title: "الإعداد الأولي" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  if (!(await needsSetup())) redirect("/login");
  const ready = await schemaReady();
  const checks = [
    { label: "قاعدة البيانات متصلة", ok: true },
    { label: ready ? "الجداول موجودة" : "الجداول غير موجودة — ستُنشأ الآن", ok: true },
    { label: "الأسرار تُولَّد تلقائياً وتُحفظ في قاعدة البيانات", ok: true },
    { label: `تخزين المرفقات: ${storageBackend() === "R2" ? "R2" : "محلي"}`, ok: true },
    { label: "مفاتيح إشعارات الدفع تُولَّد مع الإعداد", ok: true },
  ];
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl text-center mb-1">الإعداد الأولي</h1>
        <p className="text-center text-muted text-sm mb-6">ينشئ الجداول وحساب مدير المشروع وبيانات البرنامج الأساسية. يعمل مرة واحدة فقط.</p>
        <FormMessage err={err} />
        <ul className="card mb-4 text-sm space-y-1">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${c.ok ? "bg-ink" : "bg-line-2"}`} />
              {c.label}
            </li>
          ))}
        </ul>
        <form action={runSetup} className="card">
          <div className="field"><label className="label">اسم مدير المشروع</label><input name="name" className="input" defaultValue="مدير المشروع" required /></div>
          <div className="field"><label className="label">اسم المستخدم</label><input name="username" className="input" dir="ltr" defaultValue="admin" required pattern="[a-z0-9_.\-]{3,30}" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">كلمة المرور</label><input type="password" name="password" className="input" dir="ltr" required minLength={8} autoComplete="new-password" /></div>
            <div className="field"><label className="label">تأكيدها</label><input type="password" name="confirm" className="input" dir="ltr" required minLength={8} autoComplete="new-password" /></div>
          </div>
          <SubmitButton className="w-full" pendingText="جارٍ الإعداد…">إعداد المنصة</SubmitButton>
        </form>
        <p className="text-center text-xs text-muted mt-4"><Link href="/" className="underline">الصفحة الرئيسية</Link></p>
      </div>
    </main>
  );
}
