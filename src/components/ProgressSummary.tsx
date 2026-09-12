import { Card, Progress, Stat } from "@/components/ui";
import { Skeleton } from "@/components/Skeleton";
import { computeGrades } from "@/lib/grades";
import { getContinuous, programExpectations } from "@/lib/content";

/**
 * ملخّص التقدّم: أثقل جزء في الصفحة لأنه يقرأ كل سجلات المشارك.
 * يُعرض داخل Suspense فتُرسم بقية الصفحة فوراً ويصل هو بعدها،
 * بدل أن ينتظر المستخدمُ الصفحةَ كلها ريثما تُحتسب الدرجة.
 */
export default async function ProgressSummary({ userId, fallbackAssignments }: { userId: string; fallbackAssignments: number }) {
  const [grades, continuous, expected] = await Promise.all([computeGrades(userId), getContinuous(), programExpectations()]);
  const max = grades.maxes.continuous + grades.maxes.project;
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="المجموع الحالي" value={`${grades.total}`} hint={`من ${max} · ${grades.level}`} href="/app/portfolio" />
        <Stat label="بطاقات القراءة" value={grades.stats.cards} hint={`من ${grades.stats.expectedCards}`} href="/app/reading" />
        <Stat label="ساعات المعايشة" value={grades.stats.fieldHours} hint={`من ${expected.fieldHours} معتمدة`} href="/app/field" />
        <Stat label="المهام المسلّمة" value={`${grades.stats.submitted}/${grades.stats.assignments || fallbackAssignments}`} hint={`تم تقييم ${grades.stats.graded}`} href="/app/tasks" />
      </div>
      <Card title={`التقييم المستمر (${grades.maxes.continuous})`}>
        <div className="space-y-3">
          {continuous.map((c) => (
            <Progress
              key={c.key}
              label={`${c.label} (${c.points})`}
              value={{ attendance: grades.attendance, reading: grades.reading, quizzes: grades.quizzes, tasks: grades.tasks, field: grades.field, leadership: grades.leadership }[c.key] ?? 0}
              max={c.points}
            />
          ))}
        </div>
      </Card>
    </>
  );
}

/** هيكل الملخّص بالمقاسات نفسها، فلا تقفز الصفحة حين يصل المحتوى */
export function ProgressSummarySkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-14 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="card">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-44 mb-1.5" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
