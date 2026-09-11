import { cache } from "react";
import { db } from "./db";
import { WEEKS, type Week } from "./program";
import { todayKey, reportDueFrom } from "./dates";
import { cohortWhere } from "./cohort";

/** أسبوع البرنامج بعد إتاحة تعديله من لوحة مدير المشروع */
export type LiveWeek = Week & { meetingPlace?: string | null; remoteUrl?: string | null; note?: string | null };

/** أسابيع البرنامج من قاعدة البيانات، وإن لم تُبذر بعد فمن الخطة الأصلية */
export const getWeeks = cache(async (): Promise<LiveWeek[]> => {
  try {
    const rows = await db.programWeek.findMany({ where: await cohortWhere(), orderBy: { number: "asc" } });
    if (rows.length) {
      return rows.map((r) => ({
        number: r.number, label: r.label, hijri: r.hijri, gregorian: r.gregorian,
        competency: r.competency, session: r.session, circle: r.circle, reading: r.reading, task: r.task,
        meetingPlace: r.meetingPlace, remoteUrl: r.remoteUrl, note: r.note,
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

/**
 * رقم الأسبوع الحالي من تواريخ الأسابيع نفسها، فيتبع أي تعديل يجريه المدير:
 * -1 قبل البداية، ثم رقم آخر أسبوع بدأ تاريخه، و15 بعد الانتهاء.
 */
export function resolveCurrentWeek(weeks: LiveWeek[], now: Date = new Date()): number {
  const today = todayKey(now);
  const started = weeks.filter((w) => w.gregorian <= today).sort((a, b) => a.gregorian.localeCompare(b.gregorian));
  if (started.length === 0) return -1;
  const last = started[started.length - 1];
  const isLastOfProgram = last.number === Math.max(...weeks.map((w) => w.number));
  // بعد أسبوع من آخر أسبوع يُعدّ البرنامج منتهياً
  if (isLastOfProgram) {
    const end = new Date(`${last.gregorian}T00:00:00+03:00`).getTime() + 7 * 86400000;
    if (now.getTime() >= end) return 15;
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

/** موعد تسليم تقرير أسبوع بعينه، من تاريخ الأسبوع نفسه في جدول الدفعة */
export async function reportDueDate(week: number): Promise<Date> {
  const w = await getWeekByNumber(week);
  const weeks = await getWeeks();
  // إن لم يكن للأسبوع صف، يُقاس من أقرب أسبوع معلوم بفارق الأسابيع
  const base = w ?? weeks[0];
  if (!base) return new Date();
  const shift = (week - base.number) * 7 * 86400000;
  return new Date(reportDueFrom(base.gregorian).getTime() + shift);
}

/**
 * مُصنِّف يردّ رقم الأسبوع الذي يقع فيه أي تاريخ. يُرتَّب الجدول مرة واحدة
 * لا مع كل تاريخ، لأن التصنيف يجري على عشرات البطاقات في الصفحة الواحدة.
 */
export function weekResolver(weeks: LiveWeek[]): (date: Date) => number | null {
  const sorted = [...weeks].sort((a, b) => a.gregorian.localeCompare(b.gregorian));
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
