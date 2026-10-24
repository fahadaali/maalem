import { getCompletionLevels, getContinuous, getProjectRubric, levelForTotal, levelOf, programExpectations, type AssessmentRow, type Level } from "./content";
import { emptyParticipant, loadParticipant, loadParticipantsOnce, loadProgram, type ParticipantRows, type ProgramData } from "./participant-data";
import { readingTotals } from "./reading-quota";
import { returnedIds } from "./returns";
import { attendanceWeight, progressFrom, type DueProgress } from "./progress";
import { pauseOf } from "./weeks";
import { programClock } from "./pause";
import { weekEnd } from "./obligations";

type Expectations = Awaited<ReturnType<typeof programExpectations>>;

export type GradeBreakdown = {
  attendance: number; // /10
  reading: number; // /15
  quizzes: number; // /10
  tasks: number; // /20
  field: number; // /10
  leadership: number; // /5
  continuous: number; // /70
  project: number; // /30
  total: number; // /100
  level: string;
  certificate: string;
  /** سقف كل شطر كما ضُبط في اللوحة */
  maxes: { continuous: number; project: number };
  /**
   * الدرجة المرحلية: كل مكوّن مقيساً بما استُحقّ منه حتى الآن لا بالبرنامج كله، فمن
   * أتمّ كل ما حان موعده نال تمامه. المكوّن الذي لم يُستحقّ منه شيء بعد (`null`) لا
   * يدخل المقام. وما ينتظر تقييم المدير لا يُحسب على صاحبه حتى يُقيَّم. وفي ختام
   * البرنامج — وقد استُحقّ كل شيء — تقارب الدرجةَ التراكمية؛ والاعتماد والوثيقة
   * على التراكمية (`total`) وحدها.
   */
  interim: {
    parts: Record<"attendance" | "reading" | "quizzes" | "tasks" | "field" | "leadership" | "project", number | null>;
    /** مجموع ما دخل من المكوّنات، ومجموع أسقفها */
    earned: number;
    possible: number;
    /** النسبة من المستحق 0..100 — `null` قبل أن يُستحقّ شيء */
    percent: number | null;
    /** النسبة مردودةً إلى سقف الدرجة (100) */
    total: number | null;
    level: string | null;
  };
  /** المنجز من المستحق لكل بند — مؤشرات التقارير المرحلية */
  due: DueProgress;
  stats: {
    attendancePct: number;
    participationAvg: number;
    circleAvg: number;
    mentorAvg: number;
    mentorEvaluations: number;
    inPersonPct: number;
    remotePct: number;
    /** البطاقات المحتسبة (غير المُرجَعة) — عددٌ للعرض، والدرجة من الصفحات */
    cards: number;
    /** صفحات البطاقات المحتسبة، ونصاب البرنامج كله من جدوله */
    readingPages: number;
    readingRequired: number;
    quizAvgPct: number;
    quizCount: number;
    submitted: number;
    graded: number;
    assignments: number;
    reportsSubmitted: number;
    fieldHours: number;
    pendingFieldHours: number;
    leadershipActivities: number;
    peerAvg: number;
    projectStatus: string | null;
  };
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export { levelForTotal as levelFor };

/** إعدادات الدرجة المشتركة بين كل الحسابات في الطلب الواحد */
type Config = {
  weights: AssessmentRow[];
  projectRubric: AssessmentRow[];
  levels: Level[];
  expected: Expectations;
  program: ProgramData;
  now: Date;
};

export { attendanceWeight };

/**
 * الحساب نفسه — دالة نقية لا تمسّ قاعدة البيانات، فتُستعمل للمفرد وللدفعة معاً.
 *
 * ما أُرجع إلى صاحبه لا يُحتسب حتى يُعيده: البطاقة والتسليم وسجل المعايشة
 * والنشاط القيادي. وأختام مراجعتها باقية على سجلاتها، فالاستبعاد من هنا.
 */
export function computeFrom(rows: ParticipantRows, cfg: Config): GradeBreakdown {
  const { weights, projectRubric, levels, expected, program } = cfg;
  const assignments = program.assignments.length;
  const weeks = program.weeks;
  const { attendance, attempts, project, mentorEvals } = rows;
  const reports = rows.reports.length;
  const returnedSubmissions = returnedIds(rows.returns, "SUBMISSION");
  const returnedCards = returnedIds(rows.returns, "READING_CARD");
  const returnedLogs = returnedIds(rows.returns, "FIELD_LOG");
  const returnedActivities = returnedIds(rows.returns, "LEADERSHIP");
  const submissions = rows.submissions.filter((s) => !returnedSubmissions.has(s.id));
  const fieldLogs = rows.fieldLogs.filter((f) => !returnedLogs.has(f.id));
  const activities = rows.activities.filter((a) => !returnedActivities.has(a.id));
  /** وزن مكوّن التقييم كما ضُبط في اللوحة، وإلا فوزن الخطة */
  const w = (key: string, fallback: number) => weights.find((x) => x.key === key)?.points ?? fallback;

  /** متوسط تقدير من 1..5 محوَّلاً إلى نسبة 0..1 */
  const rate = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length / 5 : null);

  const score = attendanceWeight;
  const counted = attendance.filter((a) => a.status !== "EXCUSED");
  const inPerson = counted.filter((a) => a.type === "INPERSON");
  const remote = counted.filter((a) => a.type === "REMOTE");
  const pct = (arr: typeof counted) => (arr.length ? arr.reduce((s, a) => s + score(a.status), 0) / arr.length : 0);
  const attendancePct = pct(counted);
  // الحضور والمشاركة الفاعلة: الحضور 60% وبطاقة رصد المشاركة 40% متى رُصدت
  const participationRatio = rate(counted.map((a) => a.participation).filter((v): v is number => typeof v === "number"));
  const participationAvg = participationRatio ?? 0;
  const attendanceScore = round1((participationRatio === null ? attendancePct : attendancePct * 0.6 + participationRatio * 0.4) * w("attendance", 10));

  /**
   * الورد القرائي: الصفحات 70% وتقييم المشاركة في الحلقة 30% متى رُصد.
   * والصفحات تراكمية بنصاب الجدول — لا عددُ البطاقات — فبطاقةٌ بمئة صفحة تُحسب
   * مئة صفحة، والاستدراك في أسبوعٍ لاحق يُحتسب.
   */
  const reading = readingTotals(rows.cards, weeks, cfg.now, returnedCards);
  const readingRatio = reading.ratio;
  const circleRatio = rate(attendance.filter((a) => a.type === "REMOTE").map((a) => a.circleScore).filter((v): v is number => typeof v === "number"));
  const circleAvg = circleRatio ?? 0;
  const readingScore = round1((circleRatio === null ? readingRatio : readingRatio * 0.7 + circleRatio * 0.3) * w("reading", 15));

  const quizAvg = attempts.length ? attempts.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / attempts.length : 0;
  const quizScore = round1(quizAvg * w("quizzes", 10));

  const graded = submissions.filter((s) => s.gradedAt);
  const rubricSum = graded.reduce(
    (s, g) => s + ((g.completeness ?? 0) + (g.referencing ?? 0) + (g.application ?? 0) + (g.punctuality ?? 0)) / 16,
    0,
  );
  const tasksScore = assignments ? round1((rubricSum / assignments) * w("tasks", 20)) : 0;

  const approved = fieldLogs.filter((f) => f.approvedAt);
  const fieldHours = approved.reduce((s, f) => s + f.hours, 0);
  const pendingFieldHours = fieldLogs.filter((f) => !f.approvedAt).reduce((s, f) => s + f.hours, 0);
  // المعايشة: الساعات المعتمدة 70% وتقييم المشرف المرافق 30% متى وُجد
  const hoursRatio = Math.min(fieldHours / expected.fieldHours, 1);
  const mentorRatio = rate(mentorEvals.map((e) => (e.regularity + e.engagement + e.application + e.conduct + e.growth) / 5));
  const mentorAvg = mentorRatio ?? 0;
  const fieldScore = round1((mentorRatio === null ? hoursRatio : hoursRatio * 0.7 + mentorRatio * 0.3) * w("field", 10));

  const evals = activities.flatMap((a) => a.evaluations);
  const peerAvg = evals.length ? evals.reduce((s, e) => s + (e.c1 + e.c2 + e.c3 + e.c4 + e.c5) / 5, 0) / evals.length : 0;
  const leadershipScore = activities.length ? round1((peerAvg / 5) * w("leadership", 5)) : 0;

  const continuous = round1(attendanceScore + readingScore + quizScore + tasksScore + fieldScore + leadershipScore);
  const projectMax = projectRubric.reduce((s, r) => s + r.points, 0);
  const projectScore = project
    ? (project.clarity ?? 0) + (project.grounding ?? 0) + (project.design ?? 0) + (project.integration ?? 0) + (project.presentation ?? 0)
    : 0;
  const total = round1(continuous + projectScore);
  const lvl = levels.find((l) => total >= l.min) ?? levels[levels.length - 1];

  // ——— الدرجة المرحلية: المقام ما استُحقّ ———
  const due = progressFrom(rows, program, cfg.now);
  const mix = (main: number | null, side: number | null, mainShare: number) =>
    main == null ? side : side == null ? main : main * mainShare + side * (1 - mainShare);
  const scaled = (ratio: number | null, key: string, fallback: number) => (ratio == null ? null : round1(ratio * w(key, fallback)));
  const clock = programClock(cfg.now, pauseOf(weeks)).getTime();
  const w12 = weeks.find((x) => x.number === 12);
  const leadershipDue = !!w12 && weekEnd(w12).getTime() <= clock && weekEnd(w12).getTime() >= rows.user.createdAt.getTime();
  // المهام: المقيَّم من المستحق — والمسلَّم الذي ينتظر التقييم لا يُحسب عليه حتى يُقيَّم
  const taskBase = due.tasks.due - due.tasks.pending;
  const interimParts = {
    attendance: counted.length ? attendanceScore : null,
    reading: scaled(mix(due.reading.due > 0 ? Math.min(1, reading.read / due.reading.due) : null, circleRatio, 0.7), "reading", 15),
    quizzes: attempts.length ? quizScore : due.quizzes.due > 0 ? 0 : null,
    tasks: taskBase > 0 ? round1(Math.min(1, rubricSum / taskBase) * w("tasks", 20)) : null,
    field: scaled(mix(due.field.due > 0 ? Math.min(1, fieldHours / due.field.due) : null, mentorRatio, 0.7), "field", 10),
    // النشاط بلا تقييم أقرانٍ بعدُ ينتظرهم لا يُحسب عليه
    leadership: evals.length ? leadershipScore : leadershipDue ? 0 : null,
    project: project?.status === "JUDGED" ? projectScore : null,
  };
  const partMax: Record<keyof typeof interimParts, number> = {
    attendance: w("attendance", 10), reading: w("reading", 15), quizzes: w("quizzes", 10), tasks: w("tasks", 20),
    field: w("field", 10), leadership: w("leadership", 5), project: projectMax,
  };
  let earned = 0;
  let possible = 0;
  for (const k of Object.keys(interimParts) as (keyof typeof interimParts)[]) {
    const v = interimParts[k];
    if (v == null) continue;
    earned += v;
    possible += partMax[k];
  }
  const fullMax = weights.reduce((s, x) => s + x.points, 0) + projectMax;
  const interimPercent = possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null;
  const interimTotal = interimPercent == null ? null : round1((interimPercent / 100) * fullMax);

  return {
    attendance: attendanceScore,
    reading: readingScore,
    quizzes: quizScore,
    tasks: tasksScore,
    field: fieldScore,
    leadership: leadershipScore,
    continuous,
    project: projectScore,
    total,
    level: lvl.level,
    certificate: lvl.certificate,
    maxes: { continuous: weights.reduce((s, x) => s + x.points, 0), project: projectMax },
    interim: {
      parts: interimParts,
      earned: round1(earned),
      possible,
      percent: interimPercent,
      total: interimTotal,
      level: interimTotal == null ? null : levelOf(levels, interimTotal).level,
    },
    due,
    stats: {
      attendancePct: Math.round(attendancePct * 100),
      participationAvg: round1(participationAvg * 5),
      circleAvg: round1(circleAvg * 5),
      mentorAvg: round1(mentorAvg * 5),
      mentorEvaluations: mentorEvals.length,
      inPersonPct: Math.round(pct(inPerson) * 100),
      remotePct: Math.round(pct(remote) * 100),
      cards: rows.cards.filter((c) => !returnedCards.has(c.id)).length,
      readingPages: reading.read,
      readingRequired: reading.required,
      quizAvgPct: Math.round(quizAvg * 100),
      quizCount: attempts.length,
      submitted: submissions.length,
      graded: graded.length,
      assignments,
      reportsSubmitted: reports,
      fieldHours: round1(fieldHours),
      pendingFieldHours: round1(pendingFieldHours),
      leadershipActivities: activities.length,
      peerAvg: round1(peerAvg),
      projectStatus: project?.status ?? null,
    },
  };
}

/** إعدادات الدرجة المشتركة بين كل الحسابات في الطلب الواحد */
async function shared(): Promise<Config> {
  const [weights, projectRubric, levels, expected, program] = await Promise.all([
    getContinuous(),
    getProjectRubric(),
    getCompletionLevels(),
    programExpectations(),
    loadProgram(),
  ]);
  return { weights, projectRubric, levels, expected, program, now: new Date() };
}

export async function computeGrades(userId: string): Promise<GradeBreakdown> {
  const [cfg, rows] = await Promise.all([shared(), loadParticipant(userId)]);
  return computeFrom(rows ?? emptyParticipant(userId), cfg);
}

/**
 * درجات مجموعة مشاركين باستعلام واحد لكل جدول بدل استعلام لكل مشارك،
 * فكشف الدرجات لثلاثة عشر مشاركاً يكلّف عشرات الاستعلامات لا مئاتها.
 * تُعاد بالترتيب نفسه الذي وردت به المعرّفات.
 */
export async function computeGradesFor(userIds: string[]): Promise<GradeBreakdown[]> {
  if (userIds.length === 0) return [];
  const [cfg, rows] = await Promise.all([shared(), loadParticipantsOnce(userIds)]);
  return userIds.map((id) => computeFrom(rows.get(id) ?? emptyParticipant(id), cfg));
}
