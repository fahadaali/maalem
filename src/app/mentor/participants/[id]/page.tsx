import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Progress, BackLink, Badge } from "@/components/ui";
import Timeline from "@/components/Timeline";
import { buildTimeline } from "@/lib/timeline";
import { computeGrades } from "@/lib/grades";

export const metadata = { title: "مشارك في مجموعتي" };

export default async function MentorMenteePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("MENTOR");
  const { id } = await params;
  // الرابط شرطُ الوصول: من ليس في مجموعة المشرف لا يظهر له أصلاً
  const mentee = await db.user.findFirst({ where: { id, mentorId: me.id }, select: { id: true, name: true, active: true } });
  if (!mentee) notFound();

  const [grades, entries] = await Promise.all([computeGrades(mentee.id), buildTimeline(mentee.id, 120)]);

  return (
    <>
      <BackLink href="/mentor">مجموعتي</BackLink>
      <PageHeader
        title={mentee.name}
        subtitle="ما تراه هنا لمن رُبطوا بك وحدهم. الدرجات للاطلاع، واعتمادها لمدير المشروع."
        actions={!mentee.active ? <Badge>موقوف</Badge> : undefined}
      />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card title="مؤشرات الالتزام">
          <div className="space-y-3">
            <Progress value={grades.stats.attendancePct} max={100} label={`الحضور ${grades.stats.attendancePct}%`} />
            <Progress value={grades.stats.cards} max={grades.stats.expectedCards} label={`بطاقات القراءة ${grades.stats.cards} من ${grades.stats.expectedCards}`} />
            <Progress value={grades.stats.fieldHours} max={12} label={`ساعات المعايشة المعتمدة ${grades.stats.fieldHours} من 12`} />
            <Progress value={grades.stats.submitted} max={Math.max(1, grades.stats.assignments)} label={`المهام المسلّمة ${grades.stats.submitted} من ${grades.stats.assignments}`} />
            <Progress value={grades.stats.reportsSubmitted} max={12} label={`التقارير الأسبوعية ${grades.stats.reportsSubmitted} من 12`} />
          </div>
        </Card>
        <Card title="الدرجة التقديرية">
          <dl className="text-sm grid grid-cols-[1fr_auto] gap-y-1">
            <dt className="text-muted">التقييم المستمر</dt><dd className="tabular-nums">{grades.continuous} / {grades.maxes.continuous}</dd>
            <dt className="text-muted">مشروع التخرج</dt><dd className="tabular-nums">{grades.project} / {grades.maxes.project}</dd>
            <dt className="font-medium">المجموع</dt><dd className="font-bold tabular-nums">{grades.total}</dd>
            <dt className="text-muted">المستوى</dt><dd>{grades.level}</dd>
          </dl>
          <p className="text-xs text-muted mt-3">تقديرية تُحتسب آلياً حتى يعتمدها مدير المشروع.</p>
        </Card>
      </div>
      <Card title="سجل النشاط">
        <Timeline entries={entries} />
      </Card>
    </>
  );
}
