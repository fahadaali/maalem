import Link from "next/link";
import { getSession, homeFor } from "@/lib/auth";

export default async function PublicNav() {
  const session = await getSession();
  return (
    <header className="border-b border-line">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="display text-lg font-bold">معالم التربية</Link>
        <nav className="flex items-center gap-1 text-sm overflow-x-auto">
          <Link href="/program" className="px-2 py-1 rounded hover:bg-paper-2 whitespace-nowrap">البرنامج</Link>
          <Link href="/program/schedule" className="px-2 py-1 rounded hover:bg-paper-2 whitespace-nowrap">الجدول</Link>
          <Link href="/install" className="px-2 py-1 rounded hover:bg-paper-2 whitespace-nowrap">التطبيق</Link>
          {session ? (
            <Link href={homeFor(session.role)} className="btn btn-sm">لوحتي</Link>
          ) : (
            <Link href="/login" className="btn btn-sm">دخول</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
