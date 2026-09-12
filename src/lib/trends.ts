import { db } from "./db";
import { participantsWhere } from "./cohort";
import { getActiveWeeks, currentWeekNumber, weekResolver } from "./weeks";
import { attendanceWeight } from "./grades";

/** نسبة مئوية محصورة في 100: بطاقات الأسبوع الافتتاحي مثلاً تزيد على المتوقع فلا تتجاوز الرسم */
function pct(part: number, whole: number) {
  return whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;
}

export type WeekPoint = { label: string; value: number; note?: string; emphasis?: boolean };

export type Trends = {
  weeks: { number: number; title: string }[];
  participants: number;
  attendance: WeekPoint[];
  reports: WeekPoint[];
  cards: WeekPoint[];
  quizzes: WeekPoint[];
  participation: WeekPoint[];
  perParticipant: { label: string; value: number; note?: string }[];
  totals: { attendance: number; reports: number; cards: number; field: number };
};

/** اتجاهات البرنامج أسبوعاً بأسبوع للدفعة النشطة. */
export async function buildTrends(): Promise<Trends> {
  const where = await participantsWhere();
  const [people, weekRows, now] = await Promise.all([
    db.user.findMany({ where, select: { id: true, name: true } }),
    getActiveWeeks(),
    currentWeekNumber(),
  ]);
  const ids = people.map((p) => p.id);
  const weeks = weekRows.map((w) => ({ number: w.number, title: w.label }));
  const empty: Trends = {
    weeks, participants: people.length,
    attendance: [], reports: [], cards: [], quizzes: [], participation: [], perParticipant: [],
    totals: { attendance: 0, reports: 0, cards: 0, field: 0 },
  };
  if (!ids.length || !weeks.length) return empty;

  const [attendance, reports, cards, attempts, fieldLogs] = await Promise.all([
    db.attendance.findMany({ where: { userId: { in: ids } }, select: { userId: true, week: true, status: true, participation: true } }),
    db.weeklyReport.findMany({ where: { userId: { in: ids } }, select: { userId: true, week: true } }),
    db.readingCard.findMany({ where: { userId: { in: ids } }, select: { userId: true, date: true } }),
    db.quizAttempt.findMany({ where: { userId: { in: ids } }, select: { userId: true, score: true, total: true, quiz: { select: { week: true, title: true } } } }),
    db.fieldLog.findMany({ where: { userId: { in: ids }, approvedAt: { not: null } }, select: { userId: true, hours: true } }),
  ]);

  const n = people.length;
  const weekOf = weekResolver(weekRows);
  const label = (w: { number: number }) => String(w.number);
  const mark = (w: { number: number }) => w.number === now;

  const attendancePoints: WeekPoint[] = [];
  const participationPoints: WeekPoint[] = [];
  const reportPoints: WeekPoint[] = [];
  const cardPoints: WeekPoint[] = [];
  const quizPoints: WeekPoint[] = [];

  for (const w of weeks) {
    const rows = attendance.filter((a) => a.week === w.number);
    const counted = rows.filter((a) => a.status !== "EXCUSED");
    // قاعدة الاحتساب نفسها التي في كشف الدرجات: المتأخر نصف حضور
    const present = counted.reduce((s, a) => s + attendanceWeight(a.status), 0);
    attendancePoints.push({
      label: label(w), value: pct(present, counted.length), emphasis: mark(w),
      note: counted.length ? `${Math.round(present)} من ${counted.length} تسجيلاً` : "لم يُرصد الحضور",
    });

    const scores = rows.map((a) => a.participation).filter((v): v is number => typeof v === "number");
    if (scores.length) {
      participationPoints.push({
        label: label(w), emphasis: mark(w),
        value: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        note: `${scores.length} بطاقة رصد`,
      });
    } else {
      participationPoints.push({ label: label(w), value: 0, emphasis: mark(w), note: "لم تُرصد المشاركة" });
    }

    const submitted = reports.filter((r) => r.week === w.number).length;
    reportPoints.push({ label: label(w), value: pct(submitted, n), emphasis: mark(w), note: `${submitted} من ${n} مشاركاً` });

    const inWeek = cards.filter((c) => weekOf(c.date) === w.number).length;
    cardPoints.push({ label: label(w), value: pct(inWeek, n * 5), emphasis: mark(w), note: `${inWeek} بطاقة من ${n * 5} متوقعة` });

    const weekAttempts = attempts.filter((a) => a.quiz.week === w.number && a.total > 0);
    if (weekAttempts.length) {
      const avg = weekAttempts.reduce((s, a) => s + (a.score / a.total) * 100, 0) / weekAttempts.length;
      quizPoints.push({ label: label(w), value: Math.round(avg), emphasis: mark(w), note: `${weekAttempts.length} محاولة` });
    } else {
      quizPoints.push({ label: label(w), value: 0, emphasis: mark(w), note: "لا اختبار مُصحَّح" });
    }
  }

  const expectedCards = weeks.filter((w) => w.number >= 1 && w.number <= 12).length * 5;
  const perParticipant = people
    .map((p) => {
      const rows = attendance.filter((a) => a.userId === p.id && a.status !== "EXCUSED");
      const present = rows.reduce((s, a) => s + attendanceWeight(a.status), 0);
      const rep = reports.filter((r) => r.userId === p.id).length;
      const crd = cards.filter((c) => c.userId === p.id).length;
      return {
        label: p.name,
        value: pct(present, rows.length),
        note: `${rep} تقريراً · ${crd} بطاقة`,
        sort: pct(present, rows.length) + rep + crd / 10,
      };
    })
    .sort((a, b) => b.sort - a.sort)
    .map(({ label: l, value, note }) => ({ label: l, value, note }));

  const countedAll = attendance.filter((a) => a.status !== "EXCUSED");
  return {
    weeks,
    participants: n,
    attendance: attendancePoints,
    reports: reportPoints,
    cards: cardPoints,
    quizzes: quizPoints,
    participation: participationPoints,
    perParticipant,
    totals: {
      attendance: pct(countedAll.reduce((s, a) => s + attendanceWeight(a.status), 0), countedAll.length),
      reports: pct(reports.length, n * weeks.filter((w) => w.number >= 0 && w.number <= 12).length),
      cards: pct(cards.length, n * expectedCards),
      field: Math.round(fieldLogs.reduce((s, f) => s + f.hours, 0) * 10) / 10,
    },
  };
}
