import Link from "@/components/Link";
import { cn } from "@/lib/utils";

/** اسم الأسبوع في شريط التنقّل: مختصرٌ يسع الشريط على الجوال */
export function weekChipLabel(n: number): string {
  return n === 0 ? "الافتتاحي" : n === 13 ? "الختامي" : n === 14 ? "احتياطي" : String(n);
}

/**
 * شريط الأسابيع: كان يُبنى في ست صفحات بستّ صيغ، ويُعلَّم الأسبوع الحالي فيه
 * بحدٍّ رفيعٍ على شارةٍ لها حدٌّ أصلاً فلا يُرى. فصار واحداً: المختار داكن،
 * والحالي بحلقةٍ ونقطة، ولكلٍّ وسمه لقارئ الشاشة.
 */
export default function WeekChips({ weeks, selected, current, href }: { weeks: { number: number }[]; selected: number; current: number; href: (n: number) => string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4 pt-1" aria-label="الأسابيع">
      {weeks.map((w) => {
        const isSelected = w.number === selected;
        const isCurrent = w.number === current;
        return (
          <Link
            key={w.number}
            href={href(w.number)}
            scroll={false}
            prefetch={false}
            aria-current={isSelected ? "page" : undefined}
            title={isCurrent ? "الأسبوع الحالي" : undefined}
            className={cn("badge shrink-0", isSelected && "badge-ink", isCurrent && "ring-2 ring-ink ring-offset-1 ring-offset-paper font-bold")}
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
