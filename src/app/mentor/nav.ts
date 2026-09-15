import { Home, Settings, BookOpen, FileText, ClipboardList, LifeBuoy, Menu } from "lucide-react";
import type { NavItem } from "@/components/shell/AppShell";

/** الإشعارات من جرس الشريط العلوي، فلا بند لها في القائمة */
export const MENTOR_NAV: NavItem[] = [
  { href: "/mentor", label: "مجموعتي", icon: Home, exact: true, tab: true },
  { href: "/mentor/reports", label: "التقارير الأسبوعية", icon: FileText, tab: true, short: "التقارير" },
  { href: "/mentor/tasks", label: "تقييم المهام", icon: ClipboardList, tab: true, short: "المهام" },
  { href: "/program", label: "وثيقة البرنامج", icon: BookOpen, group: "البرنامج" },
  { href: "/mentor/help", label: "المساعدة", icon: LifeBuoy, group: "حسابي" },
  { href: "/mentor/settings", label: "الإعدادات", icon: Settings, group: "حسابي" },
  { href: "/mentor/more", label: "المزيد", icon: Menu, tab: true, tabOnly: true },
];
