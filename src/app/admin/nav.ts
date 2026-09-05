import { LayoutDashboard, Users, CalendarCheck, FileText, ClipboardList, ListChecks, Footprints, GraduationCap, Bell, ListTodo, Award, Settings, BookOpen } from "lucide-react";
import type { NavItem } from "@/components/shell/AppShell";

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "اللوحة", icon: LayoutDashboard, exact: true, tab: true },
  { href: "/admin/participants", label: "المشاركون", icon: Users, tab: true },
  { href: "/admin/attendance", label: "الحضور", icon: CalendarCheck, tab: true },
  { href: "/admin/reports", label: "التقارير الأسبوعية", icon: FileText, tab: true },
  { href: "/admin/tasks", label: "المهام والتقييم", icon: ClipboardList },
  { href: "/admin/quizzes", label: "الاختبارات", icon: ListChecks },
  { href: "/admin/field", label: "اعتماد المعايشة", icon: Footprints },
  { href: "/admin/projects", label: "مشاريع التخرج", icon: GraduationCap },
  { href: "/admin/grades", label: "كشف الدرجات", icon: Award },
  { href: "/admin/phases", label: "مراحل المشروع", icon: ListTodo },
  { href: "/admin/notifications", label: "الإشعارات", icon: Bell, tab: true },
  { href: "/program", label: "وثيقة البرنامج", icon: BookOpen },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];
