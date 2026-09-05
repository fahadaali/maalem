import Link from "next/link";
import { login } from "../(auth)/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/setup";
import { getSession, homeFor } from "@/lib/auth";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ err?: string; next?: string }> }) {
  const { err, next } = await searchParams;
  if (await needsSetup()) redirect("/setup");
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="display text-3xl font-bold block text-center mb-1">
          معالم التربية
        </Link>
        <p className="text-center text-muted text-sm mb-8">برنامج تأهيل المشرفين التربويين الجدد</p>
        <form action={login} className="card">
          <FormMessage err={err} />
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="field">
            <label className="label" htmlFor="username">اسم المستخدم</label>
            <input id="username" name="username" className="input" autoComplete="username" required dir="ltr" />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">كلمة المرور</label>
            <input id="password" name="password" type="password" className="input" autoComplete="current-password" required dir="ltr" />
          </div>
          <SubmitButton className="w-full" pendingText="جارٍ الدخول…">دخول</SubmitButton>
        </form>
        <p className="text-center text-xs text-muted mt-6">
          <Link href="/install" className="underline">تثبيت التطبيق على الجوال</Link>
          <span className="mx-2">·</span>
          <Link href="/program" className="underline">عن البرنامج</Link>
        </p>
      </div>
    </main>
  );
}
