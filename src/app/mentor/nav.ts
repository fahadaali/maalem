import { Home, Bell, Settings, BookOpen, FileText, ClipboardList, LifeBuoy, Menu } from "lucide-react";
import type { NavItem } from "@/components/shell/AppShell";

export const MENTOR_NAV: NavItem[] = [
  { href: "/mentor", label: "مجموعتي", icon: Home, exact: true, tab: true },
  { href: "/mentor/reports", label: "التقارير الأسبوعية", icon: FileText, tab: true, short: "التقارير" },
  { href: "/mentor/tasks", label: "تقييم المهام", icon: ClipboardList, tab: true, short: "المهام" },
  { href: "/mentor/notifications", label: "الإشعارات", icon: Bell },
  { href: "/program", label: "وثيقة البرنامج", icon: BookOpen },
  { href: "/help", label: "المساعدة", icon: LifeBuoy },
  { href: "/mentor/settings", label: "الإعدادات", icon: Settings },
  { href: "/mentor/more", label: "المزيد", icon: Menu, tab: true, tabOnly: true },
];
