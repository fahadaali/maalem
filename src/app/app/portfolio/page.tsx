import Link from "@/components/Link";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Stat } from "@/components/ui";
import { computeGrades } from "@/lib/grades";
import { PORTFOLIO_NOTE } from "@/lib/program";
import { finalTotalOf, getCompletionLevels, getContinuous, levelOf } from "@/lib/content";
import { tallyText } from "@/lib/progress";
import { InterimBars, InterimNote } from "@/components/DueProgress";
import { PROJECT_STATUS_LABELS } from "@/lib/utils";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { submitPortfolio } from "../actions";
import { formatShort } from "@/lib/dates";

export const metadata = { title: "ملف الإنجاز" };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err } = await searchParams;
  const [g, plan, reflections, tadabbur, habits, feedback, me, fg, continuous, levels] = await Promise.all([
    computeGrades(user.id),
    db.learningPlan.findUnique({ where: { userId: user.id } }),
    db.reflection.count({ where: { userId: user.id } }),
    db.tadabburStop.count({ where: { userId: user.id } }),
    db.habit.count({ where: { userId: user.id } }),
    db.feedbackSession.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    db.user.findUnique({ where: { id: user.id }, select: { portfolioSubmittedAt: true } }),
    db.finalGrade.findUnique({ where: { userId: user.id } }),
    getContinuous(),
    getCompletionLevels(),
  ]);
  const finalTotal = fg ? finalTotalOf(fg) : null;
  // مستوى المعتمدة من مجموعها بعد التعديل — قد يعبر التعديلُ حدَّ مستوى
  const finalLevel = finalTotal != null ? levelOf(levels, finalTotal) : null;
  const { due } = g;

  const items = [
    { label: "خطة التعلم الشخصية", value: plan ? "مسلّمة" : "لم تُسلَّم", href: "/app/plan" },
    { label: "الورد القرائي", value: `${tallyText(due.reading, "صفحة مستحقة")} · ${g.stats.cards} بطاقة`, href: "/app/reading" },
    { label: "التقارير الأسبوعية", value: tallyText(due.reports, "مستحقة"), href: "/app/reports" },
    { label: "المهام المسلّمة", value: `${tallyText(due.tasks, "مستحقة")} · قُيّم ${due.tasks.graded}`, href: "/app/tasks?type=tasks" },
    { label: "الاختبارات", value: `${tallyText(due.quizzes, "مستحقة")} · متوسط ${g.stats.quizAvgPct}%`, href: "/app/quizzes" },
    { label: "سجل المعايشة", value: `${tallyText(due.field, "ساعة معتمدة من المستحقة")}${due.field.pending ? ` · ${due.field.pending} بانتظار الاعتماد` : ""}`, href: "/app/field" },
    { label: "الدور القيادي", value: `${g.stats.leadershipActivities} نشاط · تقييم ${g.stats.peerAvg}/5`, href: "/app/leadership" },
    { label: "الوقفات التدبرية", value: `${tadabbur} / 3`, href: "/app/plan" },
    { label: "مشروع التخرج", value: g.stats.projectStatus ? PROJECT_STATUS_LABELS[g.stats.projectStatus] : "لم يُحدد", href: "/app/project" },
    { label: "دفتر التأمل", value: `${reflections} تأمل`, href: "/app/reflection" },
    { label: "متتبع العادات", value: `${habits} عادة`, href: "/app/habits" },
  ];

  return (
    <>
      <PageHeader
        title="ملف الإنجاز"
        subtitle={PORTFOLIO_NOTE}
        actions={<Link href="/app/portfolio/print" className="btn btn-secondary btn-sm">عرض وطباعة الملف كاملاً</Link>}
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {finalTotal != null ? (
          <Stat label="المجموع المعتمد" value={finalTotal} hint="درجة نهائية معتمدة" />
        ) : (
          <Stat label="الدرجة المرحلية" value={g.interim.total ?? "—"} hint={g.interim.total != null ? `من ${g.maxes.continuous + g.maxes.project} على المستحق حتى الآن` : "تظهر حين يُستحقّ شيء"} />
        )}
        <Stat label="الإنجاز من المستحق" value={due.percent != null ? `${due.percent}%` : "—"} hint="متوسط بنودك المستحقة" />
        <Stat label="الدرجة التراكمية" value={g.total} hint={`من ${g.maxes.continuous + g.maxes.project} على البرنامج كله`} />
        <Stat label="المستوى" value={finalLevel ? finalLevel.level : (g.interim.level ?? g.level)} hint={finalLevel ? finalLevel.certificate : "بحسب الدرجة المرحلية"} />
      </div>
      <Card title="الدرجة المرحلية بمكوّناتها" className="mb-4">
        <InterimBars grades={g} continuous={continuous} />
        <InterimNote grades={g} />
        <p className="text-xs text-muted mt-1">الدرجات تُحدَّث آلياً مع كل تسليم واعتماد؛ والدرجة النهائية يعتمدها مدير المشروع في الأسبوع 13.</p>
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
      <Card title="التسليم النهائي" className="mb-4">
        {me?.portfolioSubmittedAt ? (
          <p className="text-sm">سلّمت ملف إنجازك في {formatShort(me.portfolioSubmittedAt)}. يستطيع مدير المشروع الاطلاع عليه كاملاً.</p>
        ) : (
          <form action={submitPortfolio}>
            <p className="text-sm text-muted mb-3">
              يُسلَّم ملف الإنجاز في الأسبوع الختامي. بتسليمه يطّلع مدير المشروع على الملف كاملاً بما فيه دفتر تأملك،
              وقبل ذلك لا يظهر له إلا ما رصدته المنصة من تسليماتك.
            </p>
            <SubmitButton>تسليم ملف الإنجاز</SubmitButton>
          </form>
        )}
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
