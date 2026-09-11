"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * `prefetch` هنا لا يعني جلب Next التلقائي — ذاك يطلق الصفحات كلها دفعةً واحدة
 * عند كل فتح فتتزاحم على الخادم وينقطع بثّ إحداها. بل يُجلب المسار عند أول لمسة
 * عليه، وهي تسبق النقر بمئات أجزاء الثانية، فيبقى الانتقال فورياً بطلب واحد.
 */
export function NavLink({ href, children, className = "nav-link", exact, prefetch }: { href: string; children: ReactNode; className?: string; exact?: boolean; prefetch?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const warm = prefetch ? () => router.prefetch(href) : undefined;
  return (
    <Link
      href={href}
      className={className}
      prefetch={false}
      onPointerDown={warm}
      onTouchStart={warm}
      onMouseEnter={warm}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
