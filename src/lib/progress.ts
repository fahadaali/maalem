import { pauseOf, reportDue } from "./weeks";
import { programClock } from "./pause";
import { dueFor, type ParticipantRows, type ProgramData } from "./participant-data";
import { readingTotals } from "./reading-quota";
import { returnedIds } from "./returns";
import { fieldPlan, weekEnd } from "./obligations";

/**
 * «المنجز من المستحق»: ما أنجزه المشارك مقيساً بما حان موعده حتى الآن، لا بكل ما
 * في البرنامج.
 *
 * كانت التقارير المرحلية تقسم على المجموع كله: من سلّم أربع مهام من أربعٍ حان
 * موعدها قُرئ «4 من 20»، وتقرير الجهة في الشهر الأول يعرض متوسطاً يوحي بالتقصير
 * والدفعة ملتزمة. فصار المقام ما استُحقّ — بقواعد «مهامي» نفسها: ساعة البرنامج
 * الواقفة في الإيقاف، وما فات قبل الانضمام لا يُطالَب به، والتمديد المعتمد يؤخّر
 * الموعد، والمُرجَع لا يُعدّ منجزاً حتى يُعاد. وما أُنجز قبل موعده يُعدّ منجزاً
 * ومستحقاً معاً، فلا تتجاوز النسبة تمامها.
 *
 * دالةٌ نقية على صفوف `loadParticipant` و`loadProgram`، فيتقاسمها كشف المشاركين
 * والملف والرئيسية وتقارير الجهة والاتجاهات في الطلب نفسه بلا استعلام زائد.
 */

export type Tally = { done: number; due: number; total: number };

/** الحضور: حاضر = 1، متأخر = 0.5، معذور = لا يُحتسب، غائب = 0 — قاعدة واحدة للدرجات والاتجاهات والتقارير */
export const attendanceWeight = (status: string): number => (status === "PRESENT" ? 1 : status === "LATE" ? 0.5 : 0);

export type DueProgress = {
  /** الحضور: الحاضر واحد والمتأخر نصف من الجلسات المرصودة غير المعذورة */
  attendance: Tally;
  /** المهام المقيَّمة: المسلَّم غير المُرجَع، ومنه المقيَّم وما ينتظر التقييم */
  tasks: Tally & { graded: number; pending: number };
  reports: Tally;
  /** الورد بالصفحات */
  reading: Tally;
  /** ساعات المعايشة المعتمدة، وما ينتظر الاعتماد منها */
  field: Tally & { pending: number };
  quizzes: Tally;
  /** متوسط نسب البنود التي استُحقّ منها شيء — `null` قبل أن يُستحقّ شيء */
  percent: number | null;
};

/** نسبةٌ من المستحق محصورة في 0..1، أو لا نسبة إن لم يُستحقّ شيء */
export function ratioOf(t: Pick<Tally, "done" | "due">): number | null {
  return t.due > 0 ? Math.min(1, t.done / t.due) : null;
}

/**
 * «4 من 5» — والمستحق صفرٌ يُقرأ «لم يُستحقّ بعد»، وما أُنجز قبل أن يُستحقّ شيءٌ
 * «20 مبكراً» لا «20 من 0».
 */
export function tallyText(t: Pick<Tally, "done" | "due">, unit = ""): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  if (t.due <= 0) return t.done > 0 ? `${r(t.done)}${unit ? ` ${unit.split(" ")[0]}` : ""} مبكراً — لم يُستحقّ شيء بعد` : "لم يُستحقّ بعد";
  return `${r(t.done)} من ${r(t.due)}${unit ? ` ${unit}` : ""}`;
}

/** «4/5» للجداول الضيّقة — و«20 مبكراً» و«—» حين لا مستحقّ */
export function tallyShort(t: Pick<Tally, "done" | "due">): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  if (t.due <= 0) return t.done > 0 ? `${r(t.done)} مبكراً` : "—";
  return `${r(t.done)}/${r(t.due)}`;
}

export function progressFrom(rows: ParticipantRows, program: ProgramData, realNow: Date = new Date()): DueProgress {
  const { weeks } = program;
  const pause = pauseOf(weeks);
  const now = programClock(realNow, pause).getTime();
  const joinedAt = rows.user.createdAt.getTime();

  // ——— الحضور: ما رُصد وحده مستحق — جلسةٌ لم يُرصد حضورها لا تُحسب لأحد ولا عليه ———
  const counted = rows.attendance.filter((a) => a.status !== "EXCUSED");
  const attendance: Tally = { done: counted.reduce((s, a) => s + attendanceWeight(a.status), 0), due: counted.length, total: counted.length };

  // ——— المهام المقيَّمة ———
  const returnedSubs = returnedIds(rows.returns, "SUBMISSION");
  const submitted = new Map(rows.submissions.filter((s) => !returnedSubs.has(s.id)).map((s) => [s.assignmentId, s]));
  let taskDue = 0;
  let taskTotal = 0;
  let taskDone = 0;
  let graded = 0;
  for (const a of program.assignments) {
    const due = dueFor(a, rows.extensions).getTime();
    const s = submitted.get(a.id);
    // ما فات موعده قبل انضمامه لا يُطالَب به — إلا أن يسلّمه فيُحسب له
    if (due < joinedAt && !s) continue;
    taskTotal++;
    if (s || due <= now) taskDue++;
    if (s) {
      taskDone++;
      if (s.gradedAt) graded++;
    }
  }
  const tasks = { done: taskDone, due: taskDue, total: taskTotal, graded, pending: taskDone - graded };

  // ——— التقارير الأسبوعية: الافتتاحي حتى الثاني عشر ———
  const returnedReports = returnedIds(rows.returns, "WEEKLY_REPORT");
  const reported = new Set(rows.reports.filter((r) => !returnedReports.has(r.id)).map((r) => r.week));
  const reports: Tally = { done: 0, due: 0, total: 0 };
  for (const w of weeks) {
    if (w.number < 0 || w.number > 12) continue;
    const due = reportDue(w).getTime();
    const done = reported.has(w.number);
    if (due < joinedAt && !done) continue;
    reports.total++;
    if (done || due <= now) reports.due++;
    if (done) reports.done++;
  }

  // ——— الورد: صفحات البطاقات المحتسبة مقابل نصاب ما انقضى من أسابيعه ———
  const rt = readingTotals(rows.cards, weeks, realNow, returnedIds(rows.returns, "READING_CARD"), rows.user.createdAt);
  const reading: Tally = { done: rt.read, due: rt.requiredSoFar, total: rt.required };

  // ——— المعايشة: الساعات المعتمدة مقابل ساعات ما انقضى من أسابيعها ———
  const returnedLogs = returnedIds(rows.returns, "FIELD_LOG");
  const logs = rows.fieldLogs.filter((f) => !returnedLogs.has(f.id));
  const plan = fieldPlan(weeks, new Date(now), joinedAt);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const field = {
    done: round1(logs.filter((f) => f.approvedAt).reduce((s, f) => s + f.hours, 0)),
    pending: round1(logs.filter((f) => !f.approvedAt).reduce((s, f) => s + f.hours, 0)),
    due: plan.soFar,
    total: plan.total,
  };

  // ——— الاختبارات: المنشور ذو الأسئلة الذي انقضى أسبوعه، وما أُدّي قبل ذلك ———
  const attempted = new Set(rows.attempts.map((a) => a.quizId));
  const byNumber = new Map(weeks.map((w) => [w.number, w]));
  const quizzes: Tally = { done: 0, due: 0, total: 0 };
  for (const q of program.quizzes) {
    const done = attempted.has(q.id);
    if (!done && (!q.published || q.questions === 0)) continue;
    const wk = q.week != null ? byNumber.get(q.week) : undefined;
    // اختبارٌ بلا أسبوع لا موعد له: يُحسب إذا أُدّي وحده
    const due = wk ? weekEnd(wk).getTime() : null;
    if (due != null && due < joinedAt && !done) continue;
    quizzes.total++;
    if (done || (due != null && due <= now)) quizzes.due++;
    if (done) quizzes.done++;
  }

  const ratios = [attendance, tasks, reports, reading, field, quizzes].map(ratioOf).filter((r): r is number => r != null);
  const percent = ratios.length ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) : null;

  return { attendance, tasks, reports, reading, field, quizzes, percent };
}

/** مجموع أرقام مجموعة مشاركين — لتقارير الجهة واتجاهات الدفعة */
export function sumProgress(list: DueProgress[]) {
  const add = (pick: (p: DueProgress) => Tally): Tally => ({
    done: Math.round(list.reduce((s, p) => s + pick(p).done, 0) * 10) / 10,
    due: Math.round(list.reduce((s, p) => s + pick(p).due, 0) * 10) / 10,
    total: Math.round(list.reduce((s, p) => s + pick(p).total, 0) * 10) / 10,
  });
  const percents = list.map((p) => p.percent).filter((v): v is number => v != null);
  return {
    attendance: add((p) => p.attendance),
    tasks: { ...add((p) => p.tasks), graded: list.reduce((s, p) => s + p.tasks.graded, 0) },
    reports: add((p) => p.reports),
    reading: add((p) => p.reading),
    field: { ...add((p) => p.field), pending: Math.round(list.reduce((s, p) => s + p.field.pending, 0) * 10) / 10 },
    quizzes: add((p) => p.quizzes),
    percent: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null,
  };
}

/** نسبة مئوية من المستحق للعرض — «—» قبل أن يُستحقّ شيء */
export function percentText(t: Pick<Tally, "done" | "due">): string {
  const r = ratioOf(t);
  return r == null ? "—" : `${Math.round(r * 100)}%`;
}
