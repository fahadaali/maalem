import Link from "next/link";
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
  return (
    <>
      <PageHeader title="المزيد" />
      <div className="grid grid-cols-2 gap-3">
        {shown.map((i) => (
          <Link key={i.href} href={i.href} className="card flex items-center gap-3 hover:bg-paper-2">
            <i.icon size={20} strokeWidth={1.75} className="shrink-0" />
            <span className="text-sm">{i.label}</span>
          </Link>
        ))}
      </div>
      <form action={logout} className="mt-6">
        <button className="btn btn-secondary w-full"><LogOut size={16} /> تسجيل الخروج</button>
      </form>
    </>
  );
}
