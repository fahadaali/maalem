import { db } from "./db";
import { WEEKS, type Week } from "./program";
import { todayKey } from "./dates";

/** أسبوع البرنامج بعد إتاحة تعديله من لوحة مدير المشروع */
export type LiveWeek = Week & { meetingPlace?: string | null; remoteUrl?: string | null; note?: string | null };

/** أسابيع البرنامج من قاعدة البيانات، وإن لم تُبذر بعد فمن الخطة الأصلية */
export async function getWeeks(): Promise<LiveWeek[]> {
  try {
    const rows = await db.programWeek.findMany({ orderBy: { number: "asc" } });
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
}

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
