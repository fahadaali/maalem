import { tallyShort } from "@/lib/progress";
import { Card, Stat } from "@/components/ui";
import { Skeleton } from "@/components/Skeleton";
import { DueBars, InterimBars, InterimNote } from "@/components/DueProgress";
import { computeGrades } from "@/lib/grades";
import { getContinuous } from "@/lib/content";

/**
 * ملخّص التقدّم: أثقل جزء في الصفحة لأنه يقرأ كل سجلات المشارك.
 * يُعرض داخل Suspense فتُرسم بقية الصفحة فوراً ويصل هو بعدها،
 * بدل أن ينتظر المستخدمُ الصفحةَ كلها ريثما تُحتسب الدرجة.
 *
 * والأرقام كلها من المستحق حتى الآن لا من البرنامج كله: «4 من 4 مهام» لمن سلّم
 * كل ما حان موعده، لا «4 من 20» تقرأ تقصيراً وهو ملتزم.
 */
export default async function ProgressSummary({ userId }: { userId: string }) {
  const [grades, continuous] = await Promise.all([computeGrades(userId), getContinuous()]);
  const { due, interim } = grades;
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="الدرجة المرحلية" value={interim.total ?? "—"} hint={interim.total != null ? `من 100 على المستحق · ${interim.level}` : "تظهر حين يُستحقّ شيء"} href="/app/portfolio" />
        <Stat label="الإنجاز من المستحق" value={due.percent != null ? `${due.percent}%` : "—"} hint="متوسط بنودك المستحقة" href="/app/tasks" />
        <Stat label="المهام المسلّمة" value={tallyShort(due.tasks)} hint={`المستحقة حتى الآن · قُيّم ${due.tasks.graded}`} href="/app/tasks?type=tasks" />
        <Stat label="صفحات الورد" value={due.reading.done} hint={`${due.reading.due > 0 ? `من ${due.reading.due} مستحقة` : "لم يُستحقّ بعد"} · ${due.reading.total} في الجدول`} href="/app/reading" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="المنجز من المستحق">
          <DueBars due={due} />
        </Card>
        <Card title="الدرجة المرحلية بمكوّناتها">
          <InterimBars grades={grades} continuous={continuous} />
          <InterimNote grades={grades} />
        </Card>
      </div>
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
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, c) => (
          <div key={c} className="card">
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
        ))}
      </div>
    </>
  );
}
