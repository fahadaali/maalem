import Link from "@/components/Link";
import { PageHeader } from "@/components/ui";
import { logout } from "@/app/(auth)/actions";
import { LogOut } from "lucide-react";
import type { NavItem } from "./AppShell";

/**
 * صفحة «المزيد» للجوال: كل ما لا يتسع له شريط التبويبات.
 * بدونها تبقى أكثر صفحات اللوحة بعيدة عن متناول من يتصفح من جواله.
 */
export default function MoreGrid({ items, base }: { items: NavItem[]; base: string }) {
  const shown = items.filter((i) => i.href !== `${base}/more`);
  const groups: { title?: string; items: NavItem[] }[] = [];
  for (const i of shown) {
    const last = groups[groups.length - 1];
    if (last && last.title === i.group) last.items.push(i);
    else groups.push({ title: i.group, items: [i] });
  }
  return (
    <>
      <PageHeader title="المزيد" />
      {groups.map((g) => (
        <section key={g.title ?? "—"} className="mb-5">
          {g.title && <h2 className="text-sm text-muted mb-2">{g.title}</h2>}
          <div className="grid grid-cols-2 gap-3">
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className="card flex items-center gap-3 hover:bg-paper-2">
                <i.icon size={20} strokeWidth={1.75} className="shrink-0" />
                <span className="text-sm">{i.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <form action={logout} className="mt-6">
        <button className="btn btn-secondary w-full"><LogOut size={16} /> تسجيل الخروج</button>
      </form>
    </>
  );
}
