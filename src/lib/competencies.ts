import { db } from "./db";
import { getCompetencies, programExpectations } from "./content";

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
  const expected = await programExpectations();
  const [cards, fieldLogs, attempts, tadabbur, reports, activities, evals, plan, habitLogs, reflections, submissions] = await Promise.all([
    db.readingCard.count({ where: { userId } }),
    db.fieldLog.findMany({ where: { userId, approvedAt: { not: null } }, select: { hours: true } }),
    db.quizAttempt.findMany({ where: { userId }, select: { score: true, total: true } }),
    db.tadabburStop.count({ where: { userId } }),
    db.weeklyReport.count({ where: { userId } }),
    db.leadershipActivity.count({ where: { userId } }),
    db.peerEvaluation.findMany({ where: { activity: { userId } }, select: { c1: true, c2: true, c3: true, c4: true, c5: true } }),
    db.learningPlan.findUnique({ where: { userId }, select: { id: true } }),
    db.habitLog.count({ where: { habit: { userId } } }),
    db.reflection.count({ where: { userId } }),
    db.submission.findMany({ where: { userId, gradedAt: { not: null } }, include: { assignment: { select: { competency: true } } } }),
  ]);

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
      { label: "بطاقات القراءة", value: cards, max: expected.cards },
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
