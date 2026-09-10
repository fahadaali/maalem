import AppShell from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth";
import { Home, Bell, Settings, BookOpen, FileText, ClipboardList, LifeBuoy } from "lucide-react";

const NAV = [
  { href: "/mentor", label: "مجموعتي", icon: Home, exact: true, tab: true },
  { href: "/mentor/reports", label: "التقارير الأسبوعية", icon: FileText, tab: true },
  { href: "/mentor/tasks", label: "تقييم المهام", icon: ClipboardList, tab: true },
  { href: "/mentor/notifications", label: "الإشعارات", icon: Bell },
  { href: "/program", label: "وثيقة البرنامج", icon: BookOpen },
  { href: "/help", label: "المساعدة", icon: LifeBuoy },
  { href: "/mentor/settings", label: "الإعدادات", icon: Settings, tab: true },
];

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("MENTOR");
  return (
    <AppShell user={user} items={NAV} base="/mentor">
      {children}
    </AppShell>
  );
}
