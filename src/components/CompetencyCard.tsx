import { Card, Progress, Badge } from "@/components/ui";
import type { CompetencyAttainment } from "@/lib/competencies";

/** بطاقة الكفاءات الثماني: نسبة التحقّق لكل كفاءة وشواهدها */
export default function CompetencyCard({ rows, overall, compact }: { rows: CompetencyAttainment[]; overall: number; compact?: boolean }) {
  return (
    <Card
      title="بطاقة الكفاءات الثماني"
      action={<Badge tone="ink">التحقّق الكلي {overall}%</Badge>}
    >
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.slug}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{r.name} <span className="text-muted text-xs">الوزن {r.weight}%</span></span>
              <span className="text-muted text-xs">{r.percent}%</span>
            </div>
            <Progress value={r.percent} max={100} />
            {!compact && (
              <ul className="text-xs text-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                {r.signals.length === 0 ? (
                  <li>لا شواهد بعد — تُحتسب من المهام الموسومة بهذه الكفاءة</li>
                ) : (
                  r.signals.map((s) => <li key={s.label}>{s.label}: {s.value} / {s.max}</li>)
                )}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-3">
        تُحتسب النسبة من شواهد المنصة لكل كفاءة، وتُوزن بوزنها النسبي في الخطة. وهي مؤشر متابعة لا درجة نهائية.
      </p>
    </Card>
  );
}
