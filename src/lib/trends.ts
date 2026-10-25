import { db } from "./db";
import { participantsWhere } from "./cohort";
import { pauseOf, reportDue, resolveCurrentWeek, weekResolver } from "./weeks";
import { programClock } from "./pause";
import { cardPages, readingDeadline, weekQuota } from "./reading-quota";
import { loadParticipantsOnce, loadProgram } from "./participant-data";
import { attendanceWeight, progressFrom, sumProgress, tallyShort } from "./progress";
import { returnedIds } from "./returns";

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
  totals: { attendance: number; reports: number; cards: number; field: number; fieldDue: number; completion: number | null };
};

/**
 * اتجاهات البرنامج أسبوعاً بأسبوع للدفعة النشطة.
 *
 * والأسابيع المعروضة ما بدأ منها وحده: أسبوعٌ لم يأتِ كان يُرسم عموداً صفراً
 * فيُقرأ تقصيراً، والإجماليات من المستحق حتى الآن (`progress.ts`) لا من
 * البرنامج كله. والصفوف من المُحمِّل المشترك نفسه الذي تقرؤه الدرجات و«مهامي»،
 * فلا يفترق ما يُعرض هنا عمّا يراه المشارك: التقرير المُرجَع ليس مسلَّماً حتى يُعاد،
 * والمنضمّ متأخراً لا يُطالَب بما قبل انضمامه.
 */
export async function buildTrends(): Promise<Trends> {
  const where = await participantsWhere();
  const [people, program] = await Promise.all([db.user.findMany({ where, select: { id: true, name: true } }), loadProgram()]);
  const weekRows = program.weeks.filter((w) => w.number >= 0 && w.number <= 12);
  const now = new Date();
  const clock = programClock(now, pauseOf(program.weeks)).getTime();
  const cur = resolveCurrentWeek(program.weeks, now);
  const ids = people.map((p) => p.id);
  const weeks = weekRows.map((w) => ({ number: w.number, title: w.label }));
  const empty: Trends = {
    weeks, participants: people.length,
    attendance: [], reports: [], cards: [], quizzes: [], participation: [], perParticipant: [],
    totals: { attendance: 0, reports: 0, cards: 0, field: 0, fieldDue: 0, completion: null },
  };
  if (!ids.length || !weekRows.length) return empty;

  const rows = await loadParticipantsOnce(ids);
  const all = ids.map((id) => rows.get(id)).filter((r) => !!r);
  const progress = new Map(all.map((r) => [r.user.id, progressFrom(r, program, now)]));
  const sum = sumProgress([...progress.values()]);

  const weekOf = weekResolver(program.weeks);
  const quizWeek = new Map(program.quizzes.map((q) => [q.id, q.week]));
  // ما بدأ من الأسابيع — وبعد انتهاء البرنامج كلها
  const shown = weekRows.filter((w) => cur >= 15 || w.number <= cur);
  const label = (w: { number: number }) => String(w.number);
  const mark = (w: { number: number }) => w.number === cur;

  const attendancePoints: WeekPoint[] = [];
  const participationPoints: WeekPoint[] = [];
  const reportPoints: WeekPoint[] = [];
  const cardPoints: WeekPoint[] = [];
  const quizPoints: WeekPoint[] = [];

  for (const w of shown) {
    const att = all.flatMap((r) => r.attendance.filter((a) => a.week === w.number));
    const counted = att.filter((a) => a.status !== "EXCUSED");
    // قاعدة الاحتساب نفسها التي في كشف الدرجات: المتأخر نصف حضور
    const present = counted.reduce((s, a) => s + attendanceWeight(a.status), 0);
    attendancePoints.push({
      label: label(w), value: pct(present, counted.length), emphasis: mark(w),
      note: counted.length ? `${Math.round(present)} من ${counted.length} تسجيلاً` : "لم يُرصد الحضور",
    });

    const scores = att.map((a) => a.participation).filter((v): v is number => typeof v === "number");
    participationPoints.push(
      scores.length
        ? { label: label(w), emphasis: mark(w), value: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10, note: `${scores.length} بطاقة رصد` }
        : { label: label(w), value: 0, emphasis: mark(w), note: "لم تُرصد المشاركة" },
    );

    // التقرير: من يُطالَب به (انضمّ قبل موعده) ومن سلّمه غيرَ مُرجَع
    const due = reportDue(w).getTime();
    const owed = all.filter((r) => r.user.createdAt.getTime() <= due);
    const submitted = owed.filter((r) => {
      const returned = returnedIds(r.returns, "WEEKLY_REPORT");
      return r.reports.some((x) => x.week === w.number && !returned.has(x.id));
    }).length;
    const open = due > clock;
    reportPoints.push({
      label: label(w), value: pct(submitted, owed.length), emphasis: mark(w),
      note: `${submitted} من ${owed.length} مشاركاً${open ? " — لم يحن موعده بعد" : ""}`,
    });

    // صفحات الأسبوع من بطاقات الدفعة مقابل نصابه في الجدول لكل مُطالَبٍ به، لا عدد البطاقات
    const quota = weekQuota(w);
    if (quota) {
      const deadline = readingDeadline(w).getTime();
      const readers = all.filter((r) => r.user.createdAt.getTime() <= deadline);
      const pages = readers.reduce((s, r) => {
        const returned = returnedIds(r.returns, "READING_CARD");
        return s + r.cards.filter((c) => !returned.has(c.id) && weekOf(c.date) === w.number).reduce((t, c) => t + cardPages(c), 0);
      }, 0);
      const need = readers.length * quota.pages;
      cardPoints.push({
        label: label(w), value: pct(pages, need), emphasis: mark(w),
        note: `${pages} صفحة من ${need} مطلوبة${deadline > clock ? " — الأسبوع جارٍ" : ""}`,
      });
    }

    const weekAttempts = all.flatMap((r) => r.attempts).filter((a) => quizWeek.get(a.quizId) === w.number && a.total > 0);
    quizPoints.push(
      weekAttempts.length
        ? { label: label(w), value: Math.round(weekAttempts.reduce((s, a) => s + (a.score / a.total) * 100, 0) / weekAttempts.length), emphasis: mark(w), note: `${weekAttempts.length} محاولة` }
        : { label: label(w), value: 0, emphasis: mark(w), note: "لا اختبار مُصحَّح" },
    );
  }

  const perParticipant = people
    .map((p) => {
      const pr = progress.get(p.id);
      const att = pr ? pct(pr.attendance.done, pr.attendance.due) : 0;
      return {
        label: p.name,
        value: att,
        note: pr ? `التقارير ${tallyShort(pr.reports)} · الورد ${tallyShort(pr.reading)} صفحة · الإنجاز ${pr.percent ?? "—"}%` : undefined,
        sort: (pr?.percent ?? 0) * 1000 + att,
      };
    })
    .sort((a, b) => b.sort - a.sort)
    .map(({ label: l, value, note }) => ({ label: l, value, note }));

  return {
    weeks,
    participants: people.length,
    attendance: attendancePoints,
    reports: reportPoints,
    cards: cardPoints,
    quizzes: quizPoints,
    participation: participationPoints,
    perParticipant,
    totals: {
      attendance: pct(sum.attendance.done, sum.attendance.due),
      reports: pct(sum.reports.done, sum.reports.due),
      cards: pct(sum.reading.done, sum.reading.due),
      field: sum.field.done,
      fieldDue: sum.field.due,
      completion: sum.percent,
    },
  };
}
