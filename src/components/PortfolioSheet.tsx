import { db } from "@/lib/db";
import { computeGrades } from "@/lib/grades";
import { computeCompetencies, overallAttainment } from "@/lib/competencies";
import { PROGRAM } from "@/lib/program";
import { activeCohort } from "@/lib/cohort";
import { getContinuous, getProjectRubric } from "@/lib/content";
import { formatGregorian, formatHijri, formatShort } from "@/lib/dates";
import { PROJECT_STATUS_LABELS, ATTENDANCE_LABELS } from "@/lib/utils";

/**
 * ملف الإنجاز كاملاً في صفحة واحدة قابلة للطباعة والأرشفة.
 * includePrivate: يشمل دفتر التأمل والعادات — لا يُعرض لمدير المشروع
 * إلا بعد أن يسلّم المشارك ملفه بنفسه.
 */
export default async function PortfolioSheet({ userId, includePrivate }: { userId: string; includePrivate: boolean }) {
  const [continuous, rubric, cohort] = await Promise.all([getContinuous(), getProjectRubric(), activeCohort()]);
  const [u, grades, comps] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: {
        learningPlan: true,
        readingCards: { orderBy: { date: "asc" } },
        weeklyReports: { orderBy: { week: "asc" } },
        submissions: { include: { assignment: true }, orderBy: { submittedAt: "asc" } },
        fieldLogs: { orderBy: { date: "asc" } },
        quizAttempts: { include: { quiz: true } },
        leadership: { include: { evaluations: true } },
        peerEvaluations: false as never,
        project: true,
        tadabbur: { orderBy: { week: "asc" } },
        reflections: { orderBy: { date: "asc" } },
        habits: { include: { logs: true } },
        attendance: { orderBy: { week: "asc" } },
        certificate: true,
        finalGrade: true,
      },
    }),
    computeGrades(userId),
    computeCompetencies(userId),
  ]);
  if (!u) return null;
  const now = new Date();
  const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-6 break-inside-avoid">
      <h2 className="text-lg border-b border-line pb-1 mb-2">{title}</h2>
      {children}
    </section>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <header className="text-center border-b border-line pb-4 mb-6">
        <h1 className="text-2xl">ملف الإنجاز</h1>
        <p className="text-sm">{u.name}</p>
        <p className="text-xs text-muted">{PROGRAM.name} — {cohort?.name ?? PROGRAM.cohort}</p>
        <p className="text-xs text-muted mt-1">حُرِّر في {formatHijri(now)} الموافق {formatGregorian(now)}</p>
      </header>

      <S title="ميثاق المشاركة">
        <p className="text-sm">{u.charterAcceptedAt ? `وقّعه باسم «${u.charterName}» بتاريخ ${formatShort(u.charterAcceptedAt)}.` : "لم يُوقَّع."}</p>
      </S>

      <S title="النتيجة">
        <div className="table-wrap"><table className="table"><tbody>
          {continuous.map((c) => {
            const parts: Record<string, number> = { attendance: grades.attendance, reading: grades.reading, quizzes: grades.quizzes, tasks: grades.tasks, field: grades.field, leadership: grades.leadership };
            return <tr key={c.key}><td>{c.label}</td><td>{parts[c.key] ?? 0} / {c.points}</td></tr>;
          })}
          <tr><td className="font-medium">التقييم المستمر</td><td className="font-medium">{grades.continuous} / {grades.maxes.continuous}</td></tr>
          <tr><td className="font-medium">مشروع التخرج</td><td className="font-medium">{grades.project} / {grades.maxes.project}</td></tr>
          <tr className="bg-paper-2"><td className="font-bold">المجموع</td><td className="font-bold">{u.finalGrade ? Math.max(0, Math.min(100, Math.round((u.finalGrade.computed + u.finalGrade.adjustment) * 10) / 10)) : grades.total} / {grades.maxes.continuous + grades.maxes.project} — {grades.level}{u.finalGrade ? " (معتمدة)" : " (تقديري)"}</td></tr>
        </tbody></table></div>
        {u.certificate && <p className="text-sm mt-2">{u.certificate.kind === "ATTENDANCE" ? "إفادة حضور" : "وثيقة إتمام"} رقم <span dir="ltr">{u.certificate.serial}</span> صادرة بتاريخ {formatShort(u.certificate.issuedAt)}.</p>}
        {u.finalGrade?.reason && <p className="text-xs text-muted mt-1">تعديل مبرَّر {u.finalGrade.adjustment > 0 ? "+" : ""}{u.finalGrade.adjustment}: {u.finalGrade.reason}</p>}
      </S>

      <S title={`بطاقة الكفاءات (التحقّق الكلي ${overallAttainment(comps)}%)`}>
        <div className="table-wrap"><table className="table"><tbody>
          {comps.map((c) => <tr key={c.slug}><td>{c.name}</td><td>الوزن {c.weight}%</td><td>{c.percent}%</td></tr>)}
        </tbody></table></div>
      </S>

      {u.learningPlan && (
        <S title="خطة التعلم الشخصية">
          <p className="text-sm whitespace-pre-wrap"><span className="text-muted">الأهداف: </span>{u.learningPlan.goals}</p>
          {u.learningPlan.weeklyPlan && <p className="text-sm whitespace-pre-wrap mt-1"><span className="text-muted">الخطة الأسبوعية: </span>{u.learningPlan.weeklyPlan}</p>}
          {u.learningPlan.memorization && <p className="text-sm whitespace-pre-wrap mt-1"><span className="text-muted">مراجعة المحفوظ: </span>{u.learningPlan.memorization}</p>}
        </S>
      )}

      <S title={`الحضور (${grades.stats.attendancePct}%)`}>
        <p className="text-sm">{u.attendance.map((a) => `أ${a.week} ${a.type === "INPERSON" ? "حضوري" : "بُعد"}: ${ATTENDANCE_LABELS[a.status]}`).join(" · ") || "لم يُسجَّل حضور."}</p>
      </S>

      <S title={`بطاقات القراءة (${u.readingCards.length})`}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>التاريخ</th><th>الكتاب</th><th>الصفحات</th><th>أهم فائدة</th></tr></thead>
          <tbody>{u.readingCards.map((c) => <tr key={c.id}><td className="whitespace-nowrap">{formatShort(c.date)}</td><td>{c.book}</td><td>{c.fromPage}–{c.toPage}</td><td>{c.benefit}</td></tr>)}</tbody>
        </table></div>
      </S>

      <S title={`التقارير الأسبوعية (${u.weeklyReports.length})`}>
        {u.weeklyReports.map((r) => (
          <div key={r.id} className="mb-3 text-sm">
            <div className="font-medium">الأسبوع {r.week}</div>
            <div><span className="text-muted">الورد: </span>{r.reading}</div>
            <div><span className="text-muted">الفوائد: </span>{r.benefits}</div>
            <div><span className="text-muted">المهمة: </span>{r.taskProgress}</div>
            {r.application && <div><span className="text-muted">تطبيق ميداني: </span>{r.application}</div>}
            {r.feedback && <div><span className="text-muted">تغذية راجعة: </span>{r.feedback}</div>}
          </div>
        ))}
        {u.weeklyReports.length === 0 && <p className="text-sm text-muted">لا تقارير.</p>}
      </S>

      <S title={`المهام (${u.submissions.length})`}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>المهمة</th><th>التسليم</th><th>الدرجة</th></tr></thead>
          <tbody>{u.submissions.map((s) => <tr key={s.id}><td>{s.assignment.title}</td><td className="whitespace-nowrap">{formatShort(s.submittedAt)}</td><td>{s.gradedAt ? `${(s.completeness ?? 0) + (s.referencing ?? 0) + (s.application ?? 0) + (s.punctuality ?? 0)}/16` : "—"}</td></tr>)}</tbody>
        </table></div>
      </S>

      <S title={`سجل المعايشة الميدانية (${grades.stats.fieldHours} ساعة معتمدة)`}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>التاريخ</th><th>الساعات</th><th>المشرف المرافق</th><th>الملاحظة</th></tr></thead>
          <tbody>{u.fieldLogs.map((f) => <tr key={f.id}><td className="whitespace-nowrap">{formatShort(f.date)}</td><td>{f.hours}</td><td>{f.mentorName}</td><td>{f.note}</td></tr>)}</tbody>
        </table></div>
      </S>

      <S title="الاختبارات التكوينية">
        <p className="text-sm">{u.quizAttempts.map((q) => `${q.quiz.title}: ${q.score}/${q.total}`).join(" · ") || "لا اختبارات."}</p>
      </S>

      <S title="الوقفات التدبرية">
        <ul className="text-sm list-disc ps-5">{u.tadabbur.map((t) => <li key={t.id}>الأسبوع {t.week}: {t.topic}{t.notes ? ` — ${t.notes}` : ""}</li>)}</ul>
        {u.tadabbur.length === 0 && <p className="text-sm text-muted">لا وقفات.</p>}
      </S>

      <S title="الدور القيادي وتقييم الأقران">
        {u.leadership.map((l) => {
          const avg = l.evaluations.length ? (l.evaluations.reduce((s, e) => s + (e.c1 + e.c2 + e.c3 + e.c4 + e.c5) / 5, 0) / l.evaluations.length).toFixed(1) : "—";
          return <div key={l.id} className="text-sm mb-2"><span className="font-medium">{l.title}</span> — {formatShort(l.date)} · تقييم الأقران {avg}/5{l.report ? <div className="text-muted whitespace-pre-wrap">{l.report}</div> : null}</div>;
        })}
        {u.leadership.length === 0 && <p className="text-sm text-muted">لا أنشطة.</p>}
      </S>

      <S title="مشروع التخرج">
        {u.project ? (
          <div className="text-sm">
            <div className="font-medium">{u.project.topic}</div>
            <div className="text-muted">{PROJECT_STATUS_LABELS[u.project.status]}{u.project.mentorName ? ` · المرشد: ${u.project.mentorName}` : ""}</div>
            {u.project.problem && <p className="whitespace-pre-wrap mt-1">{u.project.problem}</p>}
            {u.project.status === "JUDGED" && (
              <ul className="list-disc ps-5 mt-2">
                {rubric.map((r) => {
                  const scores: Record<string, number | null> = { clarity: u.project!.clarity, grounding: u.project!.grounding, design: u.project!.design, integration: u.project!.integration, presentation: u.project!.presentation };
                  return <li key={r.key}>{r.label}: {scores[r.key] ?? 0} / {r.points}</li>;
                })}
              </ul>
            )}
          </div>
        ) : <p className="text-sm text-muted">لم يُحدَّد مشروع.</p>}
      </S>

      {includePrivate && (
        <>
          <S title={`دفتر التأمل (${u.reflections.length})`}>
            {u.reflections.map((r) => <p key={r.id} className="text-sm mb-2"><span className="text-muted">{formatShort(r.date)}: </span>{r.text}</p>)}
            {u.reflections.length === 0 && <p className="text-sm text-muted">لا تدوينات.</p>}
          </S>
          <S title="متتبع العادات">
            <p className="text-sm">{u.habits.map((h) => `${h.name}: ${h.logs.length} يوماً`).join(" · ") || "لا عادات."}</p>
          </S>
        </>
      )}
    </div>
  );
}
