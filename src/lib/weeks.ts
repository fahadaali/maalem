import { cache } from "react";
import { db } from "./db";
import { WEEKS, type Week } from "./program";
import { todayKey, reportDueFrom } from "./dates";
import { activeCohortState, cohortWhere } from "./cohort";
import { afterPauses, isHeld, programClock, weekStartMs, type SchedulePause } from "./pause";

/** أسبوع البرنامج بعد إتاحة تعديله من لوحة مدير المشروع */
export type LiveWeek = Week & {
  /** معرّف صف الأسبوع في القاعدة — تُنسب إليه صورة البطاقة. غائب حين تُقرأ الأسابيع من الخطة الأصلية */
  id?: string;
  meetingPlace?: string | null;
  remoteUrl?: string | null;
  note?: string | null;
  /** حالة إيقاف الدفعة — واحدةٌ لأسابيعها كلها، منها تقرأ دوال الجدولة مواعيدها (src/lib/pause.ts) */
  pause?: SchedulePause;
};

/** حالة الإيقاف من الجدول نفسه */
export function pauseOf(weeks: Pick<LiveWeek, "pause">[]): SchedulePause | undefined {
  return weeks[0]?.pause;
}

/** أسابيع البرنامج من قاعدة البيانات، وإن لم تُبذر بعد فمن الخطة الأصلية */
export const getWeeks = cache(async (): Promise<LiveWeek[]> => {
  try {
    const [rows, state] = await Promise.all([db.programWeek.findMany({ where: await cohortWhere(), orderBy: { number: "asc" } }), activeCohortState()]);
    if (rows.length) {
      return rows.map((r) => ({
        id: r.id, number: r.number, label: r.label, hijri: r.hijri, gregorian: r.gregorian,
        competency: r.competency, session: r.session, circle: r.circle, reading: r.reading, task: r.task,
        field: r.field, meetingPlace: r.meetingPlace, remoteUrl: r.remoteUrl, note: r.note,
        pause: state?.pause,
      }));
    }
  } catch {
    // القاعدة غير مهيأة بعد
  }
  return WEEKS;
});

/** الأسابيع التي يُتوقع فيها ورد وتقارير ومهام (الافتتاحي حتى 12) */
export async function getActiveWeeks(): Promise<LiveWeek[]> {
  return (await getWeeks()).filter((w) => w.number >= 0 && w.number <= 12);
}

export async function getWeekByNumber(n: number): Promise<LiveWeek | undefined> {
  return (await getWeeks()).find((w) => w.number === n);
}

/** مهام أسبوعٍ بعينه في الدفعة النشطة، مرتّبة كما رتّبها مدير المشروع */
export async function getWeekTasks(week: number) {
  return db.weekTask.findMany({ where: { week, ...(await cohortWhere()) }, orderBy: { order: "asc" } });
}

/**
 * رقم الأسبوع الحالي من تواريخ الأسابيع نفسها، فيتبع أي تعديل يجريه المدير:
 * -1 قبل البداية، ثم رقم آخر أسبوع بدأ تاريخه، و15 بعد الانتهاء.
 */
export function resolveCurrentWeek(weeks: LiveWeek[], now: Date = new Date()): number {
  // والدفعة موقوفةً يقف الأسبوع الحالي عند يوم الإيقاف: لا يتقدّم إلى أسبوعٍ تاريخُه مؤقت
  const pause = pauseOf(weeks);
  const at = programClock(now, pause);
  const today = todayKey(at);
  const started = weeks.filter((w) => w.gregorian <= today).sort((a, b) => a.gregorian.localeCompare(b.gregorian));
  if (started.length === 0) return -1;
  const last = started[started.length - 1];
  const isLastOfProgram = last.number === Math.max(...weeks.map((w) => w.number));
  // بعد أسبوع من آخر أسبوع يُعدّ البرنامج منتهياً — وأسبوعٌ امتدّ بإيقافٍ فيه يمتدّ معه
  if (isLastOfProgram) {
    const end = afterPauses(new Date(weekStartMs(last) + 7 * 86400000), weekStartMs(last), pause).getTime();
    if (at.getTime() >= end) return 15;
  }
  return last.number;
}

export async function currentWeekNumber(now: Date = new Date()): Promise<number> {
  return resolveCurrentWeek(await getWeeks(), now);
}

export async function currentWeek(now: Date = new Date()): Promise<LiveWeek | undefined> {
  const weeks = await getWeeks();
  const n = resolveCurrentWeek(weeks, now);
  return weeks.find((w) => w.number === n);
}

/**
 * موعد تقرير الأسبوع: خميسه، وبعد إزاحة إيقافٍ وقع في الأسبوع قبل خميسه —
 * فالأسبوع الذي أُوقف في منتصفه لا تُنقل بدايته، وإنما يُزاح ما بقي من مواعيده.
 */
export function reportDue(w: Pick<LiveWeek, "gregorian" | "pause">): Date {
  return afterPauses(reportDueFrom(w.gregorian), weekStartMs(w), w.pause);
}

/** موعد تسليم تقرير أسبوع بعينه، من تاريخ الأسبوع نفسه في جدول الدفعة */
export async function reportDueDate(week: number): Promise<Date> {
  const w = await getWeekByNumber(week);
  if (w) return reportDue(w);
  const weeks = await getWeeks();
  // إن لم يكن للأسبوع صف، يُقاس من أقرب أسبوع معلوم بفارق الأسابيع
  const base = weeks[0];
  if (!base) return new Date();
  const shift = (week - base.number) * 7 * 86400000;
  return new Date(reportDue(base).getTime() + shift);
}

/**
 * مُصنِّف يردّ رقم الأسبوع الذي يقع فيه أي تاريخ. يُرتَّب الجدول مرة واحدة
 * لا مع كل تاريخ، لأن التصنيف يجري على عشرات البطاقات في الصفحة الواحدة.
 */
export function weekResolver(weeks: LiveWeek[]): (date: Date) => number | null {
  // والأسبوع المؤجَّل بإيقافٍ مفتوح لا يُنسب إليه شيء: ما سُجّل في الإيقاف لأسبوعه الجاري
  const sorted = weeks.filter((w) => !isHeld(w)).sort((a, b) => a.gregorian.localeCompare(b.gregorian));
  return (date: Date) => {
    const key = todayKey(date);
    let found: number | null = null;
    for (const w of sorted) {
      if (w.gregorian > key) break;
      found = w.number;
    }
    return found;
  };
}
