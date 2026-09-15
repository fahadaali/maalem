import { LayoutDashboard, Users, CalendarCheck, FileText, ClipboardList, ListChecks, Footprints, GraduationCap, Bell, ListTodo, Award, Settings, BookOpen, Library, CalendarDays, Gauge, NotebookPen, UserPlus, Wallet, FileBarChart, BadgeCheck, MessageSquareHeart, Archive, Layers, TrendingUp, AlarmClock, FileCog, Grid3x3, Database, CalendarOff, LifeBuoy, Menu, History, ShieldCheck } from "lucide-react";
import type { NavItem } from "@/components/shell/AppShell";

/**
 * قائمة مدير المشروع في مجموعات: اثنان وثلاثون بنداً مسطَّحاً لا تُقرأ بالنظرة.
 * والبحث بابه خانة الشريط العلوي فلا بند له، والإشعارات تبقى بنداً لأن صفحتها
 * أداةُ إرسالٍ لا صندوق وارد فحسب.
 */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "اللوحة", icon: LayoutDashboard, exact: true, tab: true },

  { href: "/admin/participants", label: "المشاركون", icon: Users, group: "الدفعة" },
  { href: "/admin/attendance", label: "الحضور", icon: CalendarCheck, tab: true, group: "الدفعة" },
  { href: "/admin/excuses", label: "طلبات الاستئذان", icon: CalendarOff, group: "الدفعة" },
  { href: "/admin/cohorts", label: "الدفعات", icon: Layers, group: "الدفعة" },

  { href: "/admin/reports", label: "التقارير الأسبوعية", icon: FileText, tab: true, short: "التقارير", group: "التقييم" },
  { href: "/admin/tasks", label: "المهام والتقييم", icon: ClipboardList, group: "التقييم" },
  { href: "/admin/quizzes", label: "الاختبارات", icon: ListChecks, group: "التقييم" },
  { href: "/admin/bank", label: "بنك الأسئلة", icon: Database, group: "التقييم" },
  { href: "/admin/field", label: "اعتماد المعايشة", icon: Footprints, group: "التقييم" },
  { href: "/admin/projects", label: "مشاريع التخرج", icon: GraduationCap, group: "التقييم" },
  { href: "/admin/grades", label: "كشف الدرجات", icon: Award, group: "التقييم" },
  { href: "/admin/diagnostic", label: "التقييم التشخيصي", icon: Gauge, group: "التقييم" },

  { href: "/admin/activity", label: "مركز الأنشطة", icon: History, group: "المتابعة" },
  { href: "/admin/trends", label: "الاتجاهات", icon: TrendingUp, group: "المتابعة" },
  { href: "/admin/notifications", label: "الإشعارات", icon: Bell, tab: true, group: "المتابعة" },
  { href: "/admin/reminders", label: "التذكيرات المجدولة", icon: AlarmClock, group: "المتابعة" },

  { href: "/admin/schedule", label: "جدول البرنامج", icon: CalendarDays, group: "المحتوى" },
  { href: "/admin/materials", label: "مكتبة المواد", icon: Library, group: "المحتوى" },
  { href: "/admin/minutes", label: "محاضر اللقاءات", icon: NotebookPen, group: "المحتوى" },
  { href: "/admin/content", label: "محتوى الوثيقة", icon: FileCog, group: "المحتوى" },
  { href: "/admin/competencies", label: "مصفوفة الكفاءات", icon: Grid3x3, group: "المحتوى" },
  { href: "/admin/guests", label: "الخبراء والضيوف", icon: UserPlus, group: "المحتوى" },
  { href: "/program", label: "وثيقة البرنامج", icon: BookOpen, group: "المحتوى" },

  { href: "/admin/budget", label: "الميزانية", icon: Wallet, group: "الإدارة" },
  { href: "/admin/program-reports", label: "تقارير الجهة", icon: FileBarChart, group: "الإدارة" },
  { href: "/admin/certificates", label: "وثائق الإتمام", icon: BadgeCheck, group: "الإدارة" },
  { href: "/admin/survey", label: "استبانة الرضا", icon: MessageSquareHeart, group: "الإدارة" },
  { href: "/admin/archive", label: "الأرشفة والتصدير", icon: Archive, group: "الإدارة" },
  { href: "/admin/phases", label: "مراحل المشروع", icon: ListTodo, group: "الإدارة" },

  { href: "/admin/access", label: "الصلاحيات", icon: ShieldCheck, group: "الإعداد" },
  { href: "/admin/help", label: "مركز المساعدة", icon: LifeBuoy, group: "الإعداد" },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings, group: "الإعداد" },

  { href: "/admin/more", label: "المزيد", icon: Menu, tab: true, tabOnly: true },
];
