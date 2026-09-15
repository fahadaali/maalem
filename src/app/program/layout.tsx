import PublicNav from "@/components/PublicNav";
import { NavLink } from "@/components/shell/NavLink";
import { requireUser } from "@/lib/auth";

/** لا تُفهرس: وثيقة البرنامج محتوى داخليّ خلف الجلسة، لا صفحةَ تعريفٍ عامة */
export const metadata = { robots: { index: false, follow: false } };

const links = [
  { href: "/program", label: "بطاقة البرنامج", exact: true },
  { href: "/program/competencies", label: "مصفوفة الكفاءات" },
  { href: "/program/schedule", label: "الجدول الزمني" },
  { href: "/program/participant", label: "خطة المشارك" },
  { href: "/program/evaluation", label: "نظام التقويم" },
  { href: "/program/references", label: "المراجع" },
  { href: "/program/appendices", label: "الملاحق والنماذج" },
];

export default async function ProgramLayout({ children }: { children: React.ReactNode }) {
  // الوثيقة لمن دخل المنصة، وخطة مدير المشروع لصاحبها وحده فلا يراها غيره في القائمة
  const user = await requireUser();
  const nav = user.role === "ADMIN" ? [...links, { href: "/program/manager", label: "خطة مدير المشروع" }] : links;
  return (
    <>
      <PublicNav />
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 md:grid md:grid-cols-[220px_1fr] md:gap-10">
        <nav className="flex md:flex-col gap-1 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 mb-4 md:mb-0 whitespace-nowrap">
          {nav.map((l) => (
            <NavLink key={l.href} href={l.href} exact={l.exact}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
