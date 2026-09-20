import { db } from "./db";
import { ATTENDANCE_LABELS } from "./utils";
import { daysUntil, reportDueFrom } from "./dates";
import { weekResolver, type LiveWeek } from "./weeks";

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

/** خمس بطاقات قراءة في الأسبوع — الأحد إلى الخميس */
const CARDS_PER_WEEK = 5;

/**
 * حالة المشارك في كل أسبوع، بخمسة استعلامات لا باستعلام لكل بطاقة:
 * صفحة بطاقات الأسابيع تعرض خمسة عشر أسبوعاً، فالتجميع في الذاكرة كما في
 * `buildTrends` لا رحلةٌ إلى القاعدة مع كل صف.
 *
 * الحالة للأسبوع الحالي وما مضى فقط: أسبوعٌ لم يبدأ لا «ينقصه» شيء، وشارة
 * فارغة عليه تقرأ إنذاراً لا خبراً.
 */
export async function buildWeekStates(userId: string, weeks: LiveWeek[], now: Date = new Date()): Promise<Map<number, WeekState>> {
  const states = new Map<number, WeekState>();
  if (!weeks.length) return states;

  const [attendance, cards, attempts, fieldLogs, reports] = await Promise.all([
    db.attendance.findMany({ where: { userId }, select: { week: true, type: true, status: true } }),
    db.readingCard.findMany({ where: { userId }, select: { date: true } }),
    db.quizAttempt.findMany({ where: { userId }, select: { score: true, total: true, quiz: { select: { week: true } } } }),
    db.fieldLog.findMany({ where: { userId }, select: { date: true, hours: true, approvedAt: true } }),
    db.weeklyReport.findMany({ where: { userId }, select: { week: true } }),
  ]);

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
  const cardsBy = countBy(cards, (c) => c.date);
  const fieldBy = countBy(fieldLogs, (f) => f.date);
  const reported = new Set(reports.map((r) => r.week));

  for (const w of weeks) {
    const n = w.number;
    const state: WeekState = {};

    const inperson = attendance.find((a) => a.week === n && a.type === "INPERSON");
    if (inperson) state.session = { done: inperson.status === "PRESENT", label: ATTENDANCE_LABELS[inperson.status] ?? inperson.status };

    const cardCount = (cardsBy.get(n) ?? []).length;
    if (w.reading && w.reading !== "—") {
      state.reading = { done: cardCount >= CARDS_PER_WEEK, label: `${cardCount} من ${CARDS_PER_WEEK} بطاقات` };
    }

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
function hours(n: number): string {
  const v = Math.round(n * 10) / 10;
  if (v === 1) return "ساعة";
  if (v === 2) return "ساعتان";
  if (v <= 10) return `${v} ساعات`;
  return `${v} ساعة`;
}

/** ما بقي من المهلة بصيغة عربية سليمة: المفرد والمثنى وجمع القلة والكثرة */
function remaining(days: number): string {
  if (days === 0) return "التسليم اليوم";
  if (days === 1) return "بقي يوم واحد";
  if (days === 2) return "بقي يومان";
  if (days <= 10) return `بقيت ${days} أيام`;
  return `بقي ${days} يوماً`;
}
