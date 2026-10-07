import { db } from "./db";
import { getCompetencies, programExpectations } from "./content";
import { emptyParticipant, loadParticipant, loadProgram } from "./participant-data";
import { readingTotals } from "./reading-quota";
import { returnedIds } from "./returns";

/**
 * بطاقة الكفاءات: تحوّل شواهد المنصة إلى نسبة تحقّق لكل كفاءة من الكفاءات الثماني،
 * لأن البرنامج مبني على الكفاءات وأوزانها لا على مكوّنات التقييم وحدها.
 */
export type Signal = { label: string; value: number; max: number };
export type CompetencyAttainment = {
  slug: string;
  name: string;
  weight: number;
  percent: number;
  weighted: number;
  signals: Signal[];
};

const EXPECTED_TADABBUR = 3;
const EXPECTED_HABIT_DAYS = 28;

const pct = (v: number, m: number) => (m > 0 ? Math.min(1, v / m) : 0);

export async function computeCompetencies(userId: string): Promise<CompetencyAttainment[]> {
  // صفوف المشارك من المُحمِّل المشترك — تتقاسمها الدرجة في الطلب نفسه — وما لا يحمله يُجلب هنا
  const [expected, loaded, program, habitLogs, reflections] = await Promise.all([
    programExpectations(),
    loadParticipant(userId),
    loadProgram(),
    db.habitLog.count({ where: { habit: { userId } } }),
    db.reflection.count({ where: { userId } }),
  ]);
  const rows = loaded ?? emptyParticipant(userId);
  // ما أُرجع إلى صاحبه لا يُعدّ شاهداً حتى يُعيده
  const returnedLogs = returnedIds(rows.returns, "FIELD_LOG");
  const returnedSubs = returnedIds(rows.returns, "SUBMISSION");
  const returnedActs = returnedIds(rows.returns, "LEADERSHIP");
  const returnedReports = returnedIds(rows.returns, "WEEKLY_REPORT");
  const reading = readingTotals(rows.cards, program.weeks, new Date(), returnedIds(rows.returns, "READING_CARD"));
  const fieldLogs = rows.fieldLogs.filter((f) => f.approvedAt && !returnedLogs.has(f.id));
  const attempts = rows.attempts;
  const tadabbur = rows.tadabbur;
  const reports = rows.reports.filter((r) => !returnedReports.has(r.id)).length;
  const counted = rows.activities.filter((a) => !returnedActs.has(a.id));
  const activities = counted.length;
  const evals = counted.flatMap((a) => a.evaluations);
  const plan = rows.plan && !returnedIds(rows.returns, "LEARNING_PLAN").has(rows.plan.id) ? rows.plan : null;
  const competencyOf = new Map(program.assignments.map((a) => [a.id, a.competency]));
  const submissions = rows.submissions
    .filter((s) => s.gradedAt && !returnedSubs.has(s.id))
    .map((s) => ({ ...s, assignment: { competency: competencyOf.get(s.assignmentId) ?? null } }));

  const fieldHours = fieldLogs.reduce((s, f) => s + f.hours, 0);
  const quizAvg = attempts.length ? attempts.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / attempts.length : 0;
  const peerAvg = evals.length ? evals.reduce((s, e) => s + (e.c1 + e.c2 + e.c3 + e.c4 + e.c5) / 5, 0) / evals.length : 0;

  /** المهام المقيَّمة الموسومة بكفاءة بعينها */
  const taskSignal = (name: string): Signal | null => {
    const rows = submissions.filter((s) => s.assignment.competency === name);
    if (rows.length === 0) return null;
    const got = rows.reduce((s, g) => s + ((g.completeness ?? 0) + (g.referencing ?? 0) + (g.application ?? 0) + (g.punctuality ?? 0)), 0);
    return { label: `المهام المقيّمة (${rows.length})`, value: got, max: rows.length * 16 };
  };

  const extra: Record<string, Signal[]> = {
    educational: [
      { label: "صفحات الورد القرائي", value: reading.read, max: reading.required },
      { label: "ساعات المعايشة المعتمدة", value: Math.round(fieldHours * 10) / 10, max: expected.fieldHours },
    ],
    sharia: [
      { label: "متوسط الاختبارات", value: Math.round(quizAvg * 100), max: 100 },
      { label: "الوقفات التدبرية", value: tadabbur, max: EXPECTED_TADABBUR },
    ],
    skills: [{ label: "خطة التعلم الشخصية", value: plan ? 1 : 0, max: 1 }],
    reality: [],
    leadership: [
      { label: "الأنشطة القيادية", value: activities, max: 1 },
      { label: "تقييم الأقران", value: Math.round(peerAvg * 10) / 10, max: 5 },
    ],
    technical: [{ label: "التقارير الأسبوعية الرقمية", value: reports, max: expected.reports }],
    administrative: [],
    self: [
      { label: "أيام متتبع العادات", value: habitLogs, max: EXPECTED_HABIT_DAYS },
      { label: "تدوينات التأمل", value: reflections, max: 12 },
    ],
  };

  const defs = await getCompetencies();
  return defs.map((c) => {
    const signals = [...(extra[c.slug] ?? [])];
    const t = taskSignal(c.name);
    if (t) signals.push(t);
    const percent = signals.length ? Math.round((signals.reduce((s, x) => s + pct(x.value, x.max), 0) / signals.length) * 100) : 0;
    return { slug: c.slug, name: c.name, weight: c.weight, percent, weighted: Math.round(((percent / 100) * c.weight) * 10) / 10, signals };
  });
}

export function overallAttainment(rows: CompetencyAttainment[]): number {
  return Math.round(rows.reduce((s, r) => s + r.weighted, 0) * 10) / 10;
}
