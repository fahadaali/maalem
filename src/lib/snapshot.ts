import { db } from "./db";
import { computeGradesFor } from "./grades";
import { currentWeekNumber } from "./weeks";
import { participantsWhere } from "./cohort";

/** أرقام المنصة لحظة إعداد تقرير الجهة */
export type Snapshot = {
  week: number;
  participants: number;
  attendanceAvg: number;
  readingCards: number;
  reportsSubmitted: number;
  reportsExpected: number;
  tasksGraded: number;
  tasksSubmitted: number;
  fieldHours: number;
  quizAvg: number;
  leadership: number;
  projectsApproved: number;
  charterSigned: number;
  gradeAvg: number;
};

export async function buildSnapshot(): Promise<Snapshot> {
  const week = await currentWeekNumber();
  const participants = await db.user.findMany({ where: await participantsWhere(), select: { id: true, charterAcceptedAt: true } });
  const ids = participants.map((p) => p.id);
  const grades = await computeGradesFor(ids);
  const [cards, reports, submissions, graded, field, attempts, leadership, projects] = await Promise.all([
    db.readingCard.count({ where: { userId: { in: ids } } }),
    db.weeklyReport.count({ where: { userId: { in: ids } } }),
    db.submission.count({ where: { userId: { in: ids } } }),
    db.submission.count({ where: { userId: { in: ids }, gradedAt: { not: null } } }),
    db.fieldLog.findMany({ where: { userId: { in: ids }, approvedAt: { not: null } }, select: { hours: true } }),
    db.quizAttempt.findMany({ where: { userId: { in: ids } }, select: { score: true, total: true } }),
    db.leadershipActivity.count({ where: { userId: { in: ids } } }),
    db.graduationProject.count({ where: { userId: { in: ids }, status: { in: ["APPROVED", "DRAFT", "FINAL", "JUDGED"] } } }),
  ]);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
  return {
    week: Math.max(0, Math.min(14, week)),
    participants: participants.length,
    attendanceAvg: avg(grades.map((g) => g.stats.attendancePct)),
    readingCards: cards,
    reportsSubmitted: reports,
    reportsExpected: participants.length * Math.max(0, Math.min(12, week)),
    tasksSubmitted: submissions,
    tasksGraded: graded,
    fieldHours: Math.round(field.reduce((s, f) => s + f.hours, 0) * 10) / 10,
    quizAvg: attempts.length ? Math.round((attempts.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / attempts.length) * 100) : 0,
    leadership,
    projectsApproved: projects,
    charterSigned: participants.filter((p) => p.charterAcceptedAt).length,
    gradeAvg: avg(grades.map((g) => g.total)),
  };
}

export const SNAPSHOT_LABELS: Record<keyof Snapshot, string> = {
  week: "الأسبوع",
  participants: "عدد المشاركين",
  attendanceAvg: "متوسط الحضور %",
  readingCards: "بطاقات القراءة",
  reportsSubmitted: "التقارير المسلّمة",
  reportsExpected: "التقارير المتوقعة",
  tasksSubmitted: "المهام المسلّمة",
  tasksGraded: "المهام المقيّمة",
  fieldHours: "ساعات المعايشة المعتمدة",
  quizAvg: "متوسط الاختبارات %",
  leadership: "الأنشطة القيادية",
  projectsApproved: "مشاريع معتمدة",
  charterSigned: "موقّعو الميثاق",
  gradeAvg: "متوسط الدرجات",
};
