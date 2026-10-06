import { ATTENDANCE_LABELS } from "./utils";
import { daysUntil, reportDueFrom } from "./dates";
import { weekResolver, type LiveWeek } from "./weeks";
import { loadParticipant, loadProgram } from "./participant-data";
import { readingByWeek } from "./reading-quota";
import { returnedIds } from "./returns";

/** شارة صفٍّ واحد في بطاقة الأسبوع: ما أنجزه المشارك منه */
export type RowState = { done: boolean; label: string };

export type WeekState = {
  session?: RowState;
  reading?: RowState;
  circle?: RowState;
  field?: RowState;
  /**
   * حالةُ التقرير الأسبوعي في ذيل البطاقة.
   *
   * كان اسمه `task`، وهو يُملأ من `weeklyReport` لا من المهام — فكانت البطاقة
   * تضع شارةَ التقرير فوق نصّ المهمة تحت عنوان «المطلوب تسليمه»، فيقرأ المشاركُ
   * «مهمتي سُلّمت» والمُسلَّمُ تقريره.
   */
  report?: RowState;
};

/**
 * حالة المشارك في كل أسبوع، من صفوفه المجلوبة مرة واحدة في الطلب
 * (`loadParticipant`) لا باستعلام لكل بطاقة: صفحة بطاقات الأسابيع تعرض خمسة
 * عشر أسبوعاً، فالتجميع في الذاكرة.
 *
 * الحالة للأسبوع الحالي وما مضى فقط: أسبوعٌ لم يبدأ لا «ينقصه» شيء، وشارة
 * فارغة عليه تقرأ إنذاراً لا خبراً.
 */
export async function buildWeekStates(userId: string, weeks: LiveWeek[], now: Date = new Date()): Promise<Map<number, WeekState>> {
  const states = new Map<number, WeekState>();
  if (!weeks.length) return states;

  const [rows, program] = await Promise.all([loadParticipant(userId), loadProgram()]);
  if (!rows) return states;
  const { attendance } = rows;
  const returnedLogs = returnedIds(rows.returns, "FIELD_LOG");
  const fieldLogs = rows.fieldLogs.filter((f) => !returnedLogs.has(f.id));
  const quizWeek = new Map(program.quizzes.map((q) => [q.id, q.week]));
  const attempts = rows.attempts.map((a) => ({ ...a, quiz: { week: quizWeek.get(a.quizId) ?? null } }));
  // التقرير المُرجَع إلى صاحبه لم يُسلَّم بعد في حسابه: يعود عدّاده إلى موعده الأصلي
  const returnedReports = returnedIds(rows.returns, "WEEKLY_REPORT");
  const reports = rows.reports.filter((r) => !returnedReports.has(r.id));
  const reading = new Map(readingByWeek(rows.cards, weeks, returnedIds(rows.returns, "READING_CARD")).map((r) => [r.week, r]));

  // التاريخ يُصنَّف بجدول الدفعة نفسه، فيتبع أي تعديل يجريه المدير على المواعيد
  const weekOf = weekResolver(weeks);
  const countBy = <T>(rows: T[], date: (r: T) => Date) => {
    const m = new Map<number, T[]>();
    for (const r of rows) {
      const n = weekOf(date(r));
      if (n == null) continue;
      m.set(n, [...(m.get(n) ?? []), r]);
    }
    return m;
  };
  const fieldBy = countBy(fieldLogs, (f) => f.date);
  const reported = new Set(reports.map((r) => r.week));

  for (const w of weeks) {
    const n = w.number;
    const state: WeekState = {};

    const inperson = attendance.find((a) => a.week === n && a.type === "INPERSON");
    if (inperson) state.session = { done: inperson.status === "PRESENT", label: ATTENDANCE_LABELS[inperson.status] ?? inperson.status };

    // الورد بصفحاته مقابل نصاب الأسبوع من الجدول، لا بعدد بطاقاته
    const r = reading.get(n);
    if (r) state.reading = { done: r.read >= r.quota.pages, label: `${r.read} من ${r.quota.pages} صفحة` };

    const remote = attendance.find((a) => a.week === n && a.type === "REMOTE");
    const attempt = attempts.find((a) => a.quiz.week === n);
    const circleParts = [
      remote ? ATTENDANCE_LABELS[remote.status] ?? remote.status : null,
      attempt ? `الاختبار ${attempt.score} من ${attempt.total}` : null,
    ].filter(Boolean);
    if (circleParts.length) state.circle = { done: remote?.status === "PRESENT" && !!attempt, label: circleParts.join(" · ") };

    if (w.field) {
      const logs = fieldBy.get(n) ?? [];
      const approved = logs.filter((f) => f.approvedAt).reduce((s, f) => s + f.hours, 0);
      const pending = logs.filter((f) => !f.approvedAt).reduce((s, f) => s + f.hours, 0);
      state.field = approved
        ? { done: true, label: `${hours(approved)} معتمدة` }
        : pending
          ? { done: false, label: `${hours(pending)} بانتظار الاعتماد` }
          : { done: false, label: "لم تُسجَّل" };
    }

    // التقرير الأسبوعي مطلوب من الافتتاحي حتى الثاني عشر وحدها
    if (n >= 0 && n <= 12) {
      if (reported.has(n)) {
        state.report = { done: true, label: "التقرير مسلَّم" };
      } else {
        const left = daysUntil(reportDueFrom(w.gregorian), now);
        state.report = { done: false, label: left >= 0 ? remaining(left) : "فات الموعد" };
      }
    }

    states.set(n, state);
  }
  return states;
}

/** «ساعة» و«ساعتان» و«3 ساعات» — الرقم وحده على البطاقة يقرأ ناقصاً */
export function hours(n: number): string {
  const v = Math.round(n * 10) / 10;
  if (v === 1) return "ساعة";
  if (v === 2) return "ساعتان";
  if (v <= 10) return `${v} ساعات`;
  return `${v} ساعة`;
}

/** ما بقي من المهلة بصيغة عربية سليمة: المفرد والمثنى وجمع القلة والكثرة */
export function remaining(days: number): string {
  if (days === 0) return "التسليم اليوم";
  if (days === 1) return "بقي يوم واحد";
  if (days === 2) return "بقي يومان";
  if (days <= 10) return `بقيت ${days} أيام`;
  return `بقي ${days} يوماً`;
}
