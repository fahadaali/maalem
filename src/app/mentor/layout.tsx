import AppShell from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth";
import { Home, Bell, Settings, BookOpen } from "lucide-react";

const NAV = [
  { href: "/mentor", label: "مجموعتي", icon: Home, exact: true, tab: true },
  { href: "/mentor/notifications", label: "الإشعارات", icon: Bell, tab: true },
  { href: "/program", label: "وثيقة البرنامج", icon: BookOpen, tab: true },
  { href: "/mentor/settings", label: "الإعدادات", icon: Settings, tab: true },
];

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("MENTOR", "ADMIN");
  return (
    <AppShell user={user} items={NAV} base="/mentor">
      {children}
    </AppShell>
  );
}
