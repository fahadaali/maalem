import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { PARTICIPANT_NAV } from "../nav";
import { logout } from "@/app/(auth)/actions";
import { LogOut } from "lucide-react";

export const metadata = { title: "المزيد" };

export default function MorePage() {
  const items = PARTICIPANT_NAV.filter((i) => i.href !== "/app/more");
  return (
    <>
      <PageHeader title="المزيد" />
      <div className="grid grid-cols-2 gap-3">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="card flex items-center gap-3 hover:bg-paper-2">
            <i.icon size={20} strokeWidth={1.75} />
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
