import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, BackLink, Badge } from "@/components/ui";
import Timeline from "@/components/Timeline";
import { buildTimeline } from "@/lib/timeline";
import { computeGrades } from "@/lib/grades";
import { DueBars } from "@/components/DueProgress";

export const metadata = { title: "مشارك في مجموعتي" };

export default async function MentorMenteePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("MENTOR");
  const { id } = await params;
  // الرابط شرطُ الوصول: من ليس في مجموعة المشرف لا يظهر له أصلاً
  const mentee = await db.user.findFirst({ where: { id, mentorId: me.id }, select: { id: true, name: true, active: true } });
  if (!mentee) notFound();

  const [grades, entries] = await Promise.all([computeGrades(mentee.id), buildTimeline(mentee.id, 120, "mentor")]);

  return (
    <>
      <BackLink href="/mentor">مجموعتي</BackLink>
      <PageHeader
        title={mentee.name}
        subtitle="ما تراه هنا لمن رُبطوا بك وحدهم. الدرجات للاطلاع، واعتمادها لمدير المشروع."
        actions={!mentee.active ? <Badge>موقوف</Badge> : undefined}
      />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card title="المنجز من المستحق" action={<Badge tone="soft">{grades.due.percent != null ? `${grades.due.percent}%` : "—"}</Badge>}>
          <DueBars due={grades.due} />
          <p className="text-xs text-muted mt-3">كل بندٍ مقيسٌ بما حان موعده حتى الآن، لا بالبرنامج كله.</p>
        </Card>
        <Card title="الدرجة التقديرية">
          <dl className="text-sm grid grid-cols-[1fr_auto] gap-y-1">
            <dt className="font-medium">الدرجة المرحلية (من المستحق)</dt><dd className="font-bold tabular-nums">{grades.interim.total ?? "—"} / {grades.maxes.continuous + grades.maxes.project}</dd>
            <dt className="text-muted">المستوى بحسبها</dt><dd>{grades.interim.level ?? "—"}</dd>
            <dt className="text-muted">التقييم المستمر (تراكمي)</dt><dd className="tabular-nums">{grades.continuous} / {grades.maxes.continuous}</dd>
            <dt className="text-muted">مشروع التخرج</dt><dd className="tabular-nums">{grades.project} / {grades.maxes.project}</dd>
            <dt className="text-muted">المجموع التراكمي</dt><dd className="tabular-nums">{grades.total}</dd>
          </dl>
          <p className="text-xs text-muted mt-3">تقديرية تُحتسب آلياً حتى يعتمدها مدير المشروع؛ والاعتماد على التراكمية.</p>
        </Card>
      </div>
      <Card title="سجل النشاط">
        <Timeline entries={entries} />
      </Card>
    </>
  );
}
