import { db } from "./db";
import { COMPLETION_LEVELS } from "./program";
import { cohortWhere } from "./cohort";

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

const EXPECTED_CARDS = 60; // 5 بطاقات × 12 أسبوعاً
const EXPECTED_FIELD_HOURS = 12;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function levelFor(total: number) {
  return COMPLETION_LEVELS.find((l) => total >= l.min) ?? COMPLETION_LEVELS[COMPLETION_LEVELS.length - 1];
}

export async function computeGrades(userId: string): Promise<GradeBreakdown> {
  const [attendance, cards, attempts, assignments, submissions, reports, fieldLogs, activities, project, mentorEvals] = await Promise.all([
    db.attendance.findMany({ where: { userId } }),
    db.readingCard.count({ where: { userId } }),
    db.quizAttempt.findMany({ where: { userId } }),
    db.assignment.count({ where: await cohortWhere() }),
    db.submission.findMany({ where: { userId } }),
    db.weeklyReport.count({ where: { userId } }),
    db.fieldLog.findMany({ where: { userId } }),
    db.leadershipActivity.findMany({ where: { userId }, include: { evaluations: true } }),
    db.graduationProject.findUnique({ where: { userId } }),
    db.mentorEvaluation.findMany({ where: { userId } }),
  ]);

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
  const attendanceScore = round1((participationRatio === null ? attendancePct : attendancePct * 0.6 + participationRatio * 0.4) * 10);

  // الورد القرائي: البطاقات 70% وتقييم المشاركة في الحلقة 30% متى رُصد
  const readingRatio = Math.min(cards / EXPECTED_CARDS, 1);
  const circleRatio = rate(attendance.filter((a) => a.type === "REMOTE").map((a) => a.circleScore).filter((v): v is number => typeof v === "number"));
  const circleAvg = circleRatio ?? 0;
  const readingScore = round1((circleRatio === null ? readingRatio : readingRatio * 0.7 + circleRatio * 0.3) * 15);

  const quizAvg = attempts.length ? attempts.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / attempts.length : 0;
  const quizScore = round1(quizAvg * 10);

  const graded = submissions.filter((s) => s.gradedAt);
  const rubricSum = graded.reduce(
    (s, g) => s + ((g.completeness ?? 0) + (g.referencing ?? 0) + (g.application ?? 0) + (g.punctuality ?? 0)) / 16,
    0,
  );
  const tasksScore = assignments ? round1((rubricSum / assignments) * 20) : 0;

  const approved = fieldLogs.filter((f) => f.approvedAt);
  const fieldHours = approved.reduce((s, f) => s + f.hours, 0);
  const pendingFieldHours = fieldLogs.filter((f) => !f.approvedAt).reduce((s, f) => s + f.hours, 0);
  // المعايشة: الساعات المعتمدة 70% وتقييم المشرف المرافق 30% متى وُجد
  const hoursRatio = Math.min(fieldHours / EXPECTED_FIELD_HOURS, 1);
  const mentorRatio = rate(mentorEvals.map((e) => (e.regularity + e.engagement + e.application + e.conduct + e.growth) / 5));
  const mentorAvg = mentorRatio ?? 0;
  const fieldScore = round1((mentorRatio === null ? hoursRatio : hoursRatio * 0.7 + mentorRatio * 0.3) * 10);

  const evals = activities.flatMap((a) => a.evaluations);
  const peerAvg = evals.length ? evals.reduce((s, e) => s + (e.c1 + e.c2 + e.c3 + e.c4 + e.c5) / 5, 0) / evals.length : 0;
  const leadershipScore = activities.length ? round1((peerAvg / 5) * 5) : 0;

  const continuous = round1(attendanceScore + readingScore + quizScore + tasksScore + fieldScore + leadershipScore);
  const projectScore = project
    ? (project.clarity ?? 0) + (project.grounding ?? 0) + (project.design ?? 0) + (project.integration ?? 0) + (project.presentation ?? 0)
    : 0;
  const total = round1(continuous + projectScore);
  const lvl = levelFor(total);

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
    stats: {
      attendancePct: Math.round(attendancePct * 100),
      participationAvg: round1(participationAvg * 5),
      circleAvg: round1(circleAvg * 5),
      mentorAvg: round1(mentorAvg * 5),
      mentorEvaluations: mentorEvals.length,
      inPersonPct: Math.round(pct(inPerson) * 100),
      remotePct: Math.round(pct(remote) * 100),
      cards,
      expectedCards: EXPECTED_CARDS,
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
