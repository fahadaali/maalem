import { db } from "./db";
import { cohortWhere } from "./cohort";
import { getCompletionLevels, getContinuous, getProjectRubric, levelForTotal, programExpectations, type AssessmentRow, type Level } from "./content";

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
  stats: {
    attendancePct: number;
    participationAvg: number;
    circleAvg: number;
    mentorAvg: number;
    mentorEvaluations: number;
    inPersonPct: number;
    remotePct: number;
    cards: number;
    expectedCards: number;
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

/** السجلات التي تُحتسب منها درجة مشارك واحد */
type Rows = {
  attendance: { status: string; type: string; participation: number | null; circleScore: number | null }[];
  cards: number;
  attempts: { score: number; total: number }[];
  assignments: number;
  submissions: { gradedAt: Date | null; completeness: number | null; referencing: number | null; application: number | null; punctuality: number | null }[];
  reports: number;
  fieldLogs: { hours: number; approvedAt: Date | null }[];
  activities: { evaluations: { c1: number; c2: number; c3: number; c4: number; c5: number }[] }[];
  project: { status: string; clarity: number | null; grounding: number | null; design: number | null; integration: number | null; presentation: number | null } | null;
  mentorEvals: { regularity: number; engagement: number; application: number; conduct: number; growth: number }[];
};

/** الحساب نفسه — دالة نقية لا تمسّ قاعدة البيانات، فتُستعمل للمفرد وللدفعة معاً */
function computeFrom(rows: Rows, weights: AssessmentRow[], projectRubric: AssessmentRow[], levels: Level[], expected: Expectations): GradeBreakdown {
  const { attendance, cards, attempts, assignments, submissions, reports, fieldLogs, activities, project, mentorEvals } = rows;
  /** وزن مكوّن التقييم كما ضُبط في اللوحة، وإلا فوزن الخطة */
  const w = (key: string, fallback: number) => weights.find((x) => x.key === key)?.points ?? fallback;

  /** متوسط تقدير من 1..5 محوَّلاً إلى نسبة 0..1 */
  const rate = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length / 5 : null);

  // الحضور: حاضر = 1، متأخر = 0.5، معذور = لا يُحتسب، غائب = 0
  const score = (s: string) => (s === "PRESENT" ? 1 : s === "LATE" ? 0.5 : 0);
  const counted = attendance.filter((a) => a.status !== "EXCUSED");
  const inPerson = counted.filter((a) => a.type === "INPERSON");
  const remote = counted.filter((a) => a.type === "REMOTE");
  const pct = (arr: typeof counted) => (arr.length ? arr.reduce((s, a) => s + score(a.status), 0) / arr.length : 0);
  const attendancePct = pct(counted);
  // الحضور والمشاركة الفاعلة: الحضور 60% وبطاقة رصد المشاركة 40% متى رُصدت
  const participationRatio = rate(counted.map((a) => a.participation).filter((v): v is number => typeof v === "number"));
  const participationAvg = participationRatio ?? 0;
  const attendanceScore = round1((participationRatio === null ? attendancePct : attendancePct * 0.6 + participationRatio * 0.4) * w("attendance", 10));

  // الورد القرائي: البطاقات 70% وتقييم المشاركة في الحلقة 30% متى رُصد
  const readingRatio = Math.min(cards / expected.cards, 1);
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
    stats: {
      attendancePct: Math.round(attendancePct * 100),
      participationAvg: round1(participationAvg * 5),
      circleAvg: round1(circleAvg * 5),
      mentorAvg: round1(mentorAvg * 5),
      mentorEvaluations: mentorEvals.length,
      inPersonPct: Math.round(pct(inPerson) * 100),
      remotePct: Math.round(pct(remote) * 100),
      cards,
      expectedCards: expected.cards,
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

/** استعلامات الإعدادات المشتركة بين كل الحسابات في الطلب الواحد */
async function shared() {
  const [weights, projectRubric, levels, expected, assignments] = await Promise.all([
    getContinuous(),
    getProjectRubric(),
    getCompletionLevels(),
    programExpectations(),
    db.assignment.count({ where: await cohortWhere() }),
  ]);
  return { weights, projectRubric, levels, expected, assignments };
}

export async function computeGrades(userId: string): Promise<GradeBreakdown> {
  const [cfg, rows] = await Promise.all([shared(), loadOne(userId)]);
  return computeFrom({ ...rows, assignments: cfg.assignments }, cfg.weights, cfg.projectRubric, cfg.levels, cfg.expected);
}

async function loadOne(userId: string): Promise<Omit<Rows, "assignments">> {
  const [attendance, cards, attempts, submissions, reports, fieldLogs, activities, project, mentorEvals] = await Promise.all([
    db.attendance.findMany({ where: { userId } }),
    db.readingCard.count({ where: { userId } }),
    db.quizAttempt.findMany({ where: { userId } }),
    db.submission.findMany({ where: { userId } }),
    db.weeklyReport.count({ where: { userId } }),
    db.fieldLog.findMany({ where: { userId } }),
    db.leadershipActivity.findMany({ where: { userId }, include: { evaluations: true } }),
    db.graduationProject.findUnique({ where: { userId } }),
    db.mentorEvaluation.findMany({ where: { userId } }),
  ]);
  return { attendance, cards, attempts, submissions, reports, fieldLogs, activities, project, mentorEvals };
}

/**
 * درجات مجموعة مشاركين باستعلام واحد لكل جدول بدل استعلام لكل مشارك،
 * فكشف الدرجات لثلاثة عشر مشاركاً يكلّف عشرات الاستعلامات لا مئاتها.
 * تُعاد بالترتيب نفسه الذي وردت به المعرّفات.
 */
export async function computeGradesFor(userIds: string[]): Promise<GradeBreakdown[]> {
  if (userIds.length === 0) return [];
  const inIds = { userId: { in: userIds } };
  const [cfg, attendance, cards, attempts, submissions, reports, fieldLogs, activities, projects, mentorEvals] = await Promise.all([
    shared(),
    db.attendance.findMany({ where: inIds }),
    db.readingCard.groupBy({ by: ["userId"], where: inIds, _count: { _all: true } }),
    db.quizAttempt.findMany({ where: inIds }),
    db.submission.findMany({ where: inIds }),
    db.weeklyReport.groupBy({ by: ["userId"], where: inIds, _count: { _all: true } }),
    db.fieldLog.findMany({ where: inIds }),
    db.leadershipActivity.findMany({ where: inIds, include: { evaluations: true } }),
    db.graduationProject.findMany({ where: inIds }),
    db.mentorEvaluation.findMany({ where: inIds }),
  ]);

  const by = <T extends { userId: string }>(rows: T[], id: string) => rows.filter((r) => r.userId === id);
  const countOf = (rows: { userId: string; _count: { _all: number } }[], id: string) => rows.find((r) => r.userId === id)?._count._all ?? 0;

  return userIds.map((id) =>
    computeFrom(
      {
        attendance: by(attendance, id),
        cards: countOf(cards, id),
        attempts: by(attempts, id),
        assignments: cfg.assignments,
        submissions: by(submissions, id),
        reports: countOf(reports, id),
        fieldLogs: by(fieldLogs, id),
        activities: by(activities, id),
        project: projects.find((p) => p.userId === id) ?? null,
        mentorEvals: by(mentorEvals, id),
      },
      cfg.weights,
      cfg.projectRubric,
      cfg.levels,
      cfg.expected,
    ),
  );
}
