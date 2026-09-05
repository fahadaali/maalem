import PublicNav from "@/components/PublicNav";
import { NavLink } from "@/components/shell/NavLink";

const links = [
  { href: "/program", label: "بطاقة البرنامج", exact: true },
  { href: "/program/competencies", label: "مصفوفة الكفاءات" },
  { href: "/program/schedule", label: "الجدول الزمني" },
  { href: "/program/participant", label: "خطة المشارك" },
  { href: "/program/evaluation", label: "نظام التقويم" },
  { href: "/program/manager", label: "خطة مدير المشروع" },
  { href: "/program/references", label: "المراجع" },
  { href: "/program/appendices", label: "الملاحق والنماذج" },
];

export default function ProgramLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 md:grid md:grid-cols-[220px_1fr] md:gap-10">
        <nav className="flex md:flex-col gap-1 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 mb-4 md:mb-0 whitespace-nowrap">
          {links.map((l) => (
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
