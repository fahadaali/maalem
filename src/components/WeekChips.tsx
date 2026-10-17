import Link from "@/components/Link";
import { cn } from "@/lib/utils";
import { isHeld, type SchedulePause } from "@/lib/pause";

/** اسم الأسبوع في شريط التنقّل: مختصرٌ يسع الشريط على الجوال */
export function weekChipLabel(n: number): string {
  return n === 0 ? "الافتتاحي" : n === 13 ? "الختامي" : n === 14 ? "احتياطي" : String(n);
}

/**
 * شريط الأسابيع: كان يُبنى في ست صفحات بستّ صيغ، ويُعلَّم الأسبوع الحالي فيه
 * بحدٍّ رفيعٍ على شارةٍ لها حدٌّ أصلاً فلا يُرى. فصار واحداً: المختار داكن،
 * والحالي بحلقةٍ ونقطة، ولكلٍّ وسمه لقارئ الشاشة.
 */
export default function WeekChips({ weeks, selected, current, href }: { weeks: { number: number; gregorian?: string; pause?: SchedulePause }[]; selected: number; current: number; href: (n: number) => string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4 pt-1" aria-label="الأسابيع">
      {weeks.map((w) => {
        const isSelected = w.number === selected;
        const isCurrent = w.number === current;
        // أسبوعٌ تاريخه مؤقتٌ بإيقافٍ مفتوح: يُرى باهتاً، ويُحدَّد موعده عند الاستئناف
        const held = !!w.gregorian && isHeld({ gregorian: w.gregorian, pause: w.pause });
        return (
          <Link
            key={w.number}
            href={href(w.number)}
            scroll={false}
            prefetch={false}
            aria-current={isSelected ? "page" : undefined}
            title={isCurrent ? "الأسبوع الحالي" : held ? "مؤجَّل حتى الاستئناف" : undefined}
            className={cn("badge shrink-0", isSelected && "badge-ink", isCurrent && "ring-2 ring-ink ring-offset-1 ring-offset-paper font-bold", held && !isSelected && "opacity-60")}
          >
            {isCurrent && <span aria-hidden>●</span>}
            {weekChipLabel(w.number)}
            {isCurrent && <span className="sr-only"> (الأسبوع الحالي)</span>}
          </Link>
        );
      })}
    </nav>
  );
}
