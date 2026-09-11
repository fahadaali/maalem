"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children, className = "nav-link", exact, prefetch }: { href: string; children: ReactNode; className?: string; exact?: boolean; prefetch?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={className} prefetch={prefetch} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
