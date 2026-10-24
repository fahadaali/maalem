import { Progress } from "@/components/ui";
import type { AssessmentRow } from "@/lib/content";
import type { GradeBreakdown } from "@/lib/grades";
import { type DueProgress as Due, type Tally } from "@/lib/progress";

/**
 * عرض «المنجز من المستحق» والدرجة المرحلية، في كل موضعٍ يعرضهما — رئيسية المشارك
 * وملف إنجازه وملفه عند المدير وصفحة المشرف — فلا تفترق صيغته من صفحة إلى صفحة.
 */

/** شريطٌ لبندٍ واحد: «12 من 15 صفحة»، وما لم يُستحقّ منه شيء يُقال كذلك لا يُرسم صفراً */
export function DueBar({ label, t, unit = "", extra }: { label: string; t: Pick<Tally, "done" | "due">; unit?: string; extra?: string }) {
  if (t.due <= 0) {
    return (
      <div>
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>{label}{t.done > 0 ? ` · ${t.done}${unit ? ` ${unit}` : ""} منجزة مبكراً` : ""}</span>
          <span>لم يُستحقّ بعد</span>
        </div>
        <div className="progress"><span style={{ width: "0%" }} /></div>
      </div>
    );
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  return <Progress value={Math.min(t.done, t.due)} max={t.due} label={`${label} ${r(t.done)} من ${r(t.due)}${unit ? ` ${unit}` : ""}${extra ? ` · ${extra}` : ""}`} />;
}

/** بنود الإنجاز من المستحق كلها */
export function DueBars({ due }: { due: Due }) {
  return (
    <div className="space-y-3">
      <DueBar label="الحضور" t={due.attendance} unit="جلسة" />
      <DueBar label="المهام المسلّمة" t={due.tasks} extra={due.tasks.pending ? `${due.tasks.pending} بانتظار التقييم` : undefined} />
      <DueBar label="التقارير الأسبوعية" t={due.reports} />
      <DueBar label="الورد القرائي" t={due.reading} unit="صفحة" />
      <DueBar label="المعايشة المعتمدة" t={due.field} unit="ساعة" extra={due.field.pending ? `+${due.field.pending} بانتظار الاعتماد` : undefined} />
      <DueBar label="الاختبارات المؤدّاة" t={due.quizzes} />
    </div>
  );
}

/** مكوّنات الدرجة المرحلية بأسقفها؛ وما لم يُستحقّ منه شيء خارج المقام */
export function InterimBars({ grades, continuous }: { grades: GradeBreakdown; continuous: AssessmentRow[] }) {
  const parts = grades.interim.parts as Record<string, number | null>;
  const rows = [
    ...continuous.map((c) => ({ key: c.key, label: c.label, points: c.points, value: parts[c.key] ?? null })),
    { key: "project", label: "مشروع التخرج", points: grades.maxes.project, value: grades.interim.parts.project },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) =>
        r.value == null ? (
          <div key={r.key}>
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>{r.label} ({r.points})</span>
              <span>لم يُستحقّ بعد</span>
            </div>
            <div className="progress"><span style={{ width: "0%" }} /></div>
          </div>
        ) : (
          <Progress key={r.key} label={`${r.label} — ${r.value} من ${r.points}`} value={r.value} max={r.points} />
        ),
      )}
    </div>
  );
}

/** سطر الشرح تحت الدرجة المرحلية: ما تعنيه، والتراكمية إلى جانبها */
export function InterimNote({ grades }: { grades: GradeBreakdown }) {
  return (
    <p className="text-xs text-muted mt-3">
      الدرجة المرحلية تقيس كل مكوّن بما حان موعده منه حتى الآن، فمن أتمّ المستحق نال تمامه؛ وما ينتظر التقييم لا يُحسب عليك حتى يُقيَّم.
      الدرجة التراكمية على البرنامج كله الآن {grades.total} من {grades.maxes.continuous + grades.maxes.project}، وبها تُعتمد النتيجة النهائية.
    </p>
  );
}
