import Link from "@/components/Link";
import type { LucideIcon } from "lucide-react";
import { BookOpen, ClipboardList, FileText, FolderOpen, Gauge, GraduationCap, ListChecks, Megaphone, MessageSquareHeart, ScrollText, Sparkles, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATE_LABELS, timingLabel, weekName, type Obligation, type ObligationKind } from "@/lib/obligations";

const ICONS: Record<ObligationKind, LucideIcon> = {
  ASSIGNMENT: ClipboardList,
  REPORT: FileText,
  READING: BookOpen,
  QUIZ: ListChecks,
  FIELD: Users,
  PLAN: Target,
  CHARTER: ScrollText,
  DIAGNOSTIC: Gauge,
  LEADERSHIP: Megaphone,
  PEER_EVAL: Megaphone,
  PROJECT: GraduationCap,
  TADABBUR: Sparkles,
  SURVEY: MessageSquareHeart,
  PORTFOLIO: FolderOpen,
};

const KIND_LABELS: Record<ObligationKind, string> = {
  ASSIGNMENT: "مهمة",
  REPORT: "تقرير أسبوعي",
  READING: "الورد القرائي",
  QUIZ: "اختبار تكويني",
  FIELD: "المعايشة الميدانية",
  PLAN: "خطة التعلم",
  CHARTER: "الميثاق",
  DIAGNOSTIC: "التقييم التشخيصي",
  LEADERSHIP: "الدور القيادي",
  PEER_EVAL: "تقييم الأقران",
  PROJECT: "مشروع التخرج",
  TADABBUR: "الوقفات التدبرية",
  SURVEY: "الاستبانة",
  PORTFOLIO: "ملف الإنجاز",
};

/**
 * قائمة ما يُطلب من المشارك: تُرسم في «مهامي» والرئيسية، وفي ملف المشارك عند
 * المدير (`readOnly`: بلا أزرار فعل، والروابط إلى عناصره في الملف عبر `hrefFor`).
 *
 * والمنظومة أحادية اللون: الحال تُقرأ من وزن الشارة لا من لونها — الداكنة لما
 * يحتاج عملاً الآن (المُرجَع والمتأخر)، والخفيفة لما لم يحن أو أُنجز.
 */
export default function ObligationList({
  items,
  now,
  readOnly,
  hrefFor,
}: {
  items: Obligation[];
  now: Date;
  readOnly?: boolean;
  hrefFor?: (o: Obligation) => string | undefined;
}) {
  return (
    <ul className="divide-y divide-line">
      {items.map((o) => {
        const Icon = ICONS[o.kind];
        const timing = timingLabel(o, now);
        const urgent = o.state === "returned" || o.state === "overdue";
        const href = hrefFor ? hrefFor(o) : o.href;
        const badge = o.state === "done" ? `✓ ${o.doneLabel ?? STATE_LABELS.done}` : o.state === "returned" ? STATE_LABELS.returned : timing || STATE_LABELS[o.state];
        return (
          <li key={o.key} className="py-3 flex items-start gap-3">
            <Icon size={18} strokeWidth={1.75} className={cn("mt-1 shrink-0", urgent ? "text-ink" : "text-muted")} aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted">
                {KIND_LABELS[o.kind]}
                {o.week != null ? ` · ${weekName(o.week)}` : ""}
              </div>
              {href ? (
                <Link href={href} className="font-medium hover:underline">{o.title}</Link>
              ) : (
                <div className="font-medium">{o.title}</div>
              )}
              {o.returned && (
                <div className="text-sm mt-1 border-s-2 border-ink ps-2 whitespace-pre-wrap">
                  <span className="text-muted">ملاحظة {o.returned.by}: </span>
                  {o.returned.note}
                  {timing && o.dueAt && o.dueAt < now && <div className="text-xs mt-0.5">{timing} عن موعده الأصلي</div>}
                </div>
              )}
              {o.detail && <div className="text-xs text-muted mt-0.5">{o.detail}</div>}
              {o.progress && o.state !== "done" && (
                <div className="mt-1.5 max-w-xs">
                  <div className="flex justify-between text-[11px] text-muted mb-0.5">
                    <span>{o.progress.done} من {o.progress.total} {o.progress.unit}</span>
                  </div>
                  <div className="progress"><span style={{ width: `${o.progress.total ? Math.min(100, Math.round((o.progress.done / o.progress.total) * 100)) : 0}%` }} /></div>
                </div>
              )}
              {o.related && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {o.related.map((r) => (
                    <Link key={r.href + r.label} href={r.href} className={cn("badge", r.done && "badge-soft")}>
                      {r.done ? "✓ " : ""}يُكتب في: {r.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5 text-end">
              <span className={cn("badge", urgent ? "badge-ink" : o.state === "due" ? "" : "badge-soft")}>{badge}</span>
              {!readOnly && o.state !== "done" && o.state !== "upcoming" && (
                <Link href={o.href} className={cn("btn btn-sm", !urgent && "btn-secondary")}>{o.action}</Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
