import Link from "next/link";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Progress, Stat } from "@/components/ui";
import { computeGrades } from "@/lib/grades";
import { CONTINUOUS_ASSESSMENT, PORTFOLIO_NOTE } from "@/lib/program";
import { PROJECT_STATUS_LABELS } from "@/lib/utils";

export const metadata = { title: "ملف الإنجاز" };

export default async function PortfolioPage() {
  const user = await requireParticipantView();
  const [g, plan, reflections, tadabbur, habits, feedback] = await Promise.all([
    computeGrades(user.id),
    db.learningPlan.findUnique({ where: { userId: user.id } }),
    db.reflection.count({ where: { userId: user.id } }),
    db.tadabburStop.count({ where: { userId: user.id } }),
    db.habit.count({ where: { userId: user.id } }),
    db.feedbackSession.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
  ]);
  const parts: Record<string, number> = { attendance: g.attendance, reading: g.reading, quizzes: g.quizzes, tasks: g.tasks, field: g.field, leadership: g.leadership };

  const items = [
    { label: "خطة التعلم الشخصية", value: plan ? "مسلّمة" : "لم تُسلَّم", href: "/app/plan" },
    { label: "بطاقات القراءة", value: `${g.stats.cards} / ${g.stats.expectedCards}`, href: "/app/reading" },
    { label: "التقارير الأسبوعية", value: `${g.stats.reportsSubmitted} / 13`, href: "/app/reports" },
    { label: "المهام المسلّمة", value: `${g.stats.submitted} / ${g.stats.assignments}`, href: "/app/tasks" },
    { label: "الاختبارات", value: `${g.stats.quizCount} اختبار · متوسط ${g.stats.quizAvgPct}%`, href: "/app/quizzes" },
    { label: "سجل المعايشة", value: `${g.stats.fieldHours} ساعة معتمدة`, href: "/app/field" },
    { label: "الدور القيادي", value: `${g.stats.leadershipActivities} نشاط · تقييم ${g.stats.peerAvg}/5`, href: "/app/leadership" },
    { label: "الوقفات التدبرية", value: `${tadabbur} / 3`, href: "/app/plan" },
    { label: "مشروع التخرج", value: g.stats.projectStatus ? PROJECT_STATUS_LABELS[g.stats.projectStatus] : "لم يُحدد", href: "/app/project" },
    { label: "دفتر التأمل", value: `${reflections} تأمل`, href: "/app/reflection" },
    { label: "متتبع العادات", value: `${habits} عادة`, href: "/app/habits" },
  ];

  return (
    <>
      <PageHeader title="ملف الإنجاز" subtitle={PORTFOLIO_NOTE} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="المجموع" value={g.total} hint="من 100" />
        <Stat label="التقييم المستمر" value={g.continuous} hint="من 70" />
        <Stat label="مشروع التخرج" value={g.project} hint="من 30" />
        <Stat label="المستوى الحالي" value={g.level} hint={g.certificate} />
      </div>
      <Card title="تفصيل التقييم المستمر" className="mb-4">
        <div className="space-y-3">
          {CONTINUOUS_ASSESSMENT.map((c) => (
            <Progress key={c.key} label={`${c.component} (${c.points})`} value={parts[c.key]} max={c.points} />
          ))}
        </div>
        <p className="text-xs text-muted mt-3">الدرجات تقديرية وتُحدَّث آلياً مع كل تسليم واعتماد؛ الدرجة النهائية تُعتمد من مدير المشروع في الأسبوع 13.</p>
      </Card>
      <Card title="محتويات الملف" className="mb-4">
        <ul className="divide-y divide-line text-sm">
          {items.map((i) => (
            <li key={i.label} className="py-2 flex justify-between gap-3">
              <Link href={i.href} className="hover:underline">{i.label}</Link>
              <span className="text-muted">{i.value}</span>
            </li>
          ))}
        </ul>
      </Card>
      {feedback.length > 0 && (
        <Card title="جلسات التغذية الراجعة الفردية">
          <ul className="divide-y divide-line text-sm">
            {feedback.map((f) => (
              <li key={f.id} className="py-2">
                <div className="text-xs text-muted">{new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(f.date)}</div>
                <div className="whitespace-pre-wrap">{f.notes}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
