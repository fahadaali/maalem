import Link from "@/components/Link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, LogOut } from "lucide-react";
import { NavLink } from "./NavLink";
import WarmTabs from "./WarmTabs";
import AppBadge from "@/components/AppBadge";
import type { SessionUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/utils";
import { db } from "@/lib/db";
import { logout } from "@/app/(auth)/actions";

/** `short` تسمية مختصرة لشريط تبويبات الجوال حيث لا يتسع النص الطويل */
export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; tab?: boolean; tabOnly?: boolean; short?: string };

export default async function AppShell({ user, items, children, base }: { user: SessionUser; items: NavItem[]; children: ReactNode; base: string }) {
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const tabs = items.filter((i) => i.tab);
  const sideItems = items.filter((i) => !i.tabOnly);
  const notificationsHref = `${base}/notifications`;

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      {/* الشريط الجانبي (سطح المكتب) */}
      <aside className="shell-side md:w-64 flex-col border-e border-line p-4 sticky top-0 h-dvh">
        <Link href={base} className="display text-xl font-bold px-2 mb-6 block">
          معالم التربية
        </Link>
        {/*
          min-h-0 مع التمرير: القائمة أطول من الشاشة في لوحة الإدارة — اثنان
          وثلاثون رابطاً — والإطار ملتصق بارتفاع الشاشة، فكانت أواخرها تخرج
          خارجها ولا سبيل إلى الوصول إليها على أي جهاز. وبغير min-h-0 لا ينكمش
          عنصر الـ flex فلا يعمل التمرير.
        */}
        <nav className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
          {sideItems.map((i) => (
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
        {/*
          الارتفاع يضيف حشوة المنطقة الآمنة إلى ارتفاع الشريط بدل أن تقتطع منه:
          مع h-14 وحدها كان محتوى الترويسة ينضغط بمقدار شريط حالة الجهاز فيبدو مقصوصاً.
        */}
        <header
          className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-line px-4 flex items-center justify-between"
          style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.5rem + env(safe-area-inset-top))" }}
        >
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

        <main className="app-main flex-1 px-4 py-5 md:px-8 md:py-8 max-w-6xl w-full mx-auto">{children}</main>

        {/* شريط التبويبات (الجوال) */}
        <nav className="shell-tabs fixed bottom-0 inset-x-0 z-20 bg-paper border-t border-line" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}>
          {/* تبويبات الجوال هي المسارات الساخنة: تُسخَّن بالتتابع وعند اللمس، لا دفعةً واحدة */}
          {tabs.map((i) => (
            <NavLink key={i.href} href={i.href} exact={i.exact} prefetch className="tabbar-link">
              <i.icon size={20} strokeWidth={1.75} />
              <span>{i.short ?? i.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <AppBadge count={unread} />
      <WarmTabs hrefs={tabs.filter((i) => i.href !== base).map((i) => i.href)} home={base} />
    </div>
  );
}
