import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, LogOut } from "lucide-react";
import { NavLink } from "./NavLink";
import type { SessionUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/utils";
import { db } from "@/lib/db";
import { logout } from "@/app/(auth)/actions";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; tab?: boolean };

export default async function AppShell({ user, items, children, base }: { user: SessionUser; items: NavItem[]; children: ReactNode; base: string }) {
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const tabs = items.filter((i) => i.tab);
  const notificationsHref = `${base}/notifications`;

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      {/* الشريط الجانبي (سطح المكتب) */}
      <aside className="hidden md:flex md:w-64 flex-col border-e border-line p-4 sticky top-0 h-dvh">
        <Link href={base} className="display text-xl font-bold px-2 mb-6 block">
          معالم التربية
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          {items.map((i) => (
            <NavLink key={i.href} href={i.href} exact={i.exact}>
              <i.icon size={18} strokeWidth={1.75} />
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line pt-3 mt-3 text-sm">
          <div className="font-medium">{user.name}</div>
          <div className="text-muted text-xs">{ROLE_LABELS[user.role]}</div>
          <form action={logout} className="mt-2">
            <button className="btn btn-ghost btn-sm">
              <LogOut size={14} /> تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* الشريط العلوي */}
        <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-line px-4 h-14 flex items-center justify-between" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <Link href={base} className="display text-lg font-bold md:hidden">
            معالم التربية
          </Link>
          <div className="hidden md:block text-sm text-muted">{ROLE_LABELS[user.role]} · {user.name}</div>
          <Link href={notificationsHref} className="relative p-2 rounded-full hover:bg-paper-2" aria-label="الإشعارات">
            <Bell size={20} strokeWidth={1.75} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -start-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-paper text-[10px] flex items-center justify-center font-bold">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        </header>

        <main className="flex-1 px-4 py-5 md:px-8 md:py-8 max-w-6xl w-full mx-auto pb-24 md:pb-8">{children}</main>

        {/* شريط التبويبات (الجوال) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-paper border-t border-line flex" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {tabs.map((i) => (
            <NavLink key={i.href} href={i.href} exact={i.exact} className="tabbar-link">
              <i.icon size={20} strokeWidth={1.75} />
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
