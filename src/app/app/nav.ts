import { Home, BookOpen, ClipboardList, FileText, ListChecks, Users, Megaphone, GraduationCap, Target, PenLine, Repeat, FolderOpen, Settings, Menu, CalendarDays, Library, ScrollText, Gauge, NotebookPen, Target as TargetIcon, BadgeCheck, MessageSquareHeart, CalendarOff, LifeBuoy, History } from "lucide-react";
import type { NavItem } from "@/components/shell/AppShell";

/**
 * قائمة المشارك في مجموعات لا في قائمة مسطَّحة.
 *
 * ولا مكان فيها للإشعارات ولا للبحث: بابهما زرّا الشريط العلوي — الجرس وخانة
 * البحث — فلا يُفتح لهما بابان. والصفحتان باقيتان كما هما، إنما وُحّد المدخل.
 * وبطاقات الأسابيع تُغني عن «وثيقة الجدول» في الوثيقة العامة، فالجدول نفسه
 * بحال المشارك عليه.
 */
export const PARTICIPANT_NAV: NavItem[] = [
  { href: "/app", label: "الرئيسية", icon: Home, exact: true, tab: true },

  { href: "/app/week", label: "بطاقات الأسابيع", icon: CalendarDays, group: "أسبوعي", tab: true, short: "الأسابيع" },
  { href: "/app/reading", label: "القراءة", icon: BookOpen, group: "أسبوعي", tab: true },
  { href: "/app/tasks", label: "المهام", icon: ClipboardList, group: "أسبوعي", tab: true },
  { href: "/app/reports", label: "التقارير الأسبوعية", icon: FileText, group: "أسبوعي", tab: true, short: "التقارير" },
  { href: "/app/quizzes", label: "الاختبارات", icon: ListChecks, group: "أسبوعي" },

  { href: "/app/field", label: "المعايشة الميدانية", icon: Users, group: "مساري" },
  { href: "/app/leadership", label: "الدور القيادي", icon: Megaphone, group: "مساري" },
  { href: "/app/project", label: "مشروع التخرج", icon: GraduationCap, group: "مساري" },
  { href: "/app/plan", label: "خطة التعلم", icon: Target, group: "مساري" },
  { href: "/app/reflection", label: "دفتر التأمل", icon: PenLine, group: "مساري" },
  { href: "/app/habits", label: "متتبع العادات", icon: Repeat, group: "مساري" },
  { href: "/app/competencies", label: "بطاقة الكفاءات", icon: TargetIcon, group: "مساري" },
  { href: "/app/diagnostic", label: "التقييم التشخيصي", icon: Gauge, group: "مساري" },

  { href: "/app/portfolio", label: "ملف الإنجاز", icon: FolderOpen, group: "سجلّاتي" },
  { href: "/app/timeline", label: "سجل نشاطي", icon: History, group: "سجلّاتي" },
  { href: "/app/certificate", label: "وثيقة الإتمام", icon: BadgeCheck, group: "سجلّاتي" },

  { href: "/app/materials", label: "مكتبة المواد", icon: Library, group: "البرنامج" },
  { href: "/app/minutes", label: "محاضر اللقاءات", icon: NotebookPen, group: "البرنامج" },
  { href: "/app/charter", label: "ميثاق المشاركة", icon: ScrollText, group: "البرنامج" },

  { href: "/app/excuses", label: "الاستئذان والتأجيل", icon: CalendarOff, group: "حسابي" },
  { href: "/app/survey", label: "استبانة الرضا", icon: MessageSquareHeart, group: "حسابي" },
  { href: "/app/help", label: "المساعدة", icon: LifeBuoy, group: "حسابي" },
  { href: "/app/settings", label: "الإعدادات", icon: Settings, group: "حسابي" },

  { href: "/app/more", label: "المزيد", icon: Menu, tab: true, tabOnly: true },
];
