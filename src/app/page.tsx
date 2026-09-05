import Link from "next/link";
import { BookOpen, CalendarDays, ClipboardList, Smartphone, Users, GraduationCap } from "lucide-react";
import PublicNav from "@/components/PublicNav";
import { COMPETENCIES, PROGRAM } from "@/lib/program";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";

export default async function Home() {
  // نقطة الدخول الموحّدة للتطبيق: من كان داخلاً يُنقل إلى لوحته مباشرة
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  const features = [
    { icon: BookOpen, title: "الورد القرائي", text: "بطاقة قراءة يومية من الأحد إلى الخميس، مع أربعة كتب موجّهة." },
    { icon: ClipboardList, title: "التقارير والمهام", text: "تقرير أسبوعي رقمي بقالب موحد، ومهام تطبيقية تُقيَّم بسلم تقدير." },
    { icon: Users, title: "المعايشة الميدانية", text: "سجل معايشة موثق يعتمده المشرف المرافق، 12 ساعة على الأقل." },
    { icon: CalendarDays, title: "الجدول الأسبوعي", text: "لقاء حضوري كل سبت، وحلقة نقاش عن بُعد كل ثلاثاء، على مدى 14 أسبوعاً." },
    { icon: GraduationCap, title: "مشروع التخرج", text: "مبادرة تطبيقية من ميدان المشارك تُعرض أمام لجنة التحكيم في الأسبوع 13." },
    { icon: Smartphone, title: "تطبيق على جوالك", text: "ثبّت المنصة على الآيفون والأندرويد واستقبل التذكيرات والإشعارات." },
  ];
  return (
    <>
      <PublicNav />
      <main className="max-w-5xl mx-auto px-4">
        <section className="py-14 md:py-20 text-center">
          <div className="text-xs text-muted mb-3">{PROGRAM.cohort}</div>
          <h1 className="text-4xl md:text-6xl mb-4">{PROGRAM.name}</h1>
          <p className="text-lg text-ink-2 max-w-2xl mx-auto">{PROGRAM.subtitle}</p>
          <p className="text-sm text-muted max-w-2xl mx-auto mt-2">{PROGRAM.period}</p>
          <div className="flex justify-center gap-3 mt-8 flex-wrap">
            <Link href="/login" className="btn">
              تسجيل الدخول
            </Link>
            <Link href="/program" className="btn btn-secondary">تعرّف على البرنامج</Link>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
          {features.map((f) => (
            <div key={f.title} className="card">
              <f.icon size={22} strokeWidth={1.5} className="mb-3" />
              <h3 className="text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="pb-16">
          <h2 className="text-2xl mb-4">الكفاءات الثماني</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {COMPETENCIES.map((c) => (
              <Link key={c.slug} href={`/program/competencies#${c.slug}`} className="card card-muted hover:bg-paper-3">
                <div className="text-3xl display font-bold">{c.weight}%</div>
                <div className="text-sm mt-1">{c.name}</div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">{PROGRAM.version}</footer>
    </>
  );
}
