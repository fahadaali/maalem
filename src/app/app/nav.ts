import { Home, BookOpen, ClipboardList, FileText, ListChecks, Users, Megaphone, GraduationCap, Target, PenLine, Repeat, FolderOpen, Bell, Settings, Menu, CalendarDays, Library, ScrollText, Gauge, NotebookPen, Target as TargetIcon, BadgeCheck, MessageSquareHeart, CalendarOff } from "lucide-react";
import type { NavItem } from "@/components/shell/AppShell";

export const PARTICIPANT_NAV: NavItem[] = [
  { href: "/app", label: "الرئيسية", icon: Home, exact: true, tab: true },
  { href: "/app/reading", label: "القراءة", icon: BookOpen, tab: true },
  { href: "/app/tasks", label: "المهام", icon: ClipboardList, tab: true },
  { href: "/app/reports", label: "التقارير الأسبوعية", icon: FileText },
  { href: "/app/quizzes", label: "الاختبارات", icon: ListChecks },
  { href: "/app/field", label: "المعايشة الميدانية", icon: Users },
  { href: "/app/leadership", label: "الدور القيادي", icon: Megaphone },
  { href: "/app/project", label: "مشروع التخرج", icon: GraduationCap },
  { href: "/app/plan", label: "خطة التعلم", icon: Target },
  { href: "/app/materials", label: "مكتبة المواد", icon: Library },
  { href: "/app/minutes", label: "محاضر اللقاءات", icon: NotebookPen },
  { href: "/app/competencies", label: "بطاقة الكفاءات", icon: TargetIcon },
  { href: "/app/charter", label: "ميثاق المشاركة", icon: ScrollText },
  { href: "/app/diagnostic", label: "التقييم التشخيصي", icon: Gauge },
  { href: "/app/reflection", label: "دفتر التأمل", icon: PenLine },
  { href: "/app/habits", label: "متتبع العادات", icon: Repeat },
  { href: "/app/portfolio", label: "ملف الإنجاز", icon: FolderOpen, tab: true },
  { href: "/app/certificate", label: "وثيقة الإتمام", icon: BadgeCheck },
  { href: "/app/survey", label: "استبانة الرضا", icon: MessageSquareHeart },
  { href: "/app/excuses", label: "الاستئذان والتأجيل", icon: CalendarOff },
  { href: "/program/schedule", label: "جدول البرنامج", icon: CalendarDays },
  { href: "/app/notifications", label: "الإشعارات", icon: Bell },
  { href: "/app/settings", label: "الإعدادات", icon: Settings },
  { href: "/app/more", label: "المزيد", icon: Menu, tab: true, tabOnly: true },
];
