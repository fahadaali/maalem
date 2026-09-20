import Link from "@/components/Link";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Badge, Empty } from "@/components/ui";
import { formatShort } from "@/lib/dates";
import { cohortWhere } from "@/lib/cohort";

export const metadata = { title: "المهام الأسبوعية" };

export default async function TasksPage() {
  const user = await requireParticipantView();
  const assignments = await db.assignment.findMany({ where: await cohortWhere(), orderBy: [{ week: "asc" }, { dueAt: "asc" }], include: { submissions: { where: { userId: user.id } } } });
  const now = new Date();
  return (
    <>
      <PageHeader title="المهام الأسبوعية" subtitle="مهمة تطبيقية كل أسبوع تُقيَّم بسلم التقدير (ملحق 2): الاكتمال، والربط بالمرجع، والتطبيق الميداني، والالتزام بالموعد." />
      {/*
        المهمةُ والتقريرُ تسليمان مختلفان: هذه ناتجٌ يُرفع ويُقيَّم من ستّ عشرة،
        وذاك تقريرٌ ذاتيٌّ عن الأسبوع كلِّه بلا درجة. فيُقال الفرقُ هنا صراحةً —
        وكان المشاركُ يفتح مهمةً ظانّاً أنها التقرير.
      */}
      <p className="text-sm text-muted -mt-2 mb-4">
        والتقريرُ الأسبوعي تسليمٌ آخر يُكتب كلَّ خميس عن الأسبوع كلِّه:{" "}
        <Link href="/app/reports" className="underline hover:text-ink">التقارير الأسبوعية</Link>
      </p>
      {assignments.length === 0 ? (
        <Empty>لم تُنشر مهام بعد.</Empty>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => {
            const s = a.submissions[0];
            const total = s?.gradedAt ? (s.completeness ?? 0) + (s.referencing ?? 0) + (s.application ?? 0) + (s.punctuality ?? 0) : null;
            const late = !s && a.dueAt < now;
            return (
              <Link key={a.id} href={`/app/tasks/${a.id}`} className="card flex items-center justify-between gap-3 hover:bg-paper-2">
                <div className="min-w-0">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted">الأسبوع {a.week} · التسليم {formatShort(a.dueAt)}{a.competency ? ` · ${a.competency}` : ""}</div>
                </div>
                <div className="shrink-0">
                  {total != null ? <Badge tone="ink">{total}/16</Badge> : s ? <Badge>مسلّم</Badge> : late ? <Badge>متأخر</Badge> : <Badge tone="soft">مفتوح</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
