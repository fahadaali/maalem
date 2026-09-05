import { PROGRAM, WEEKS, type Week } from "./program";

const TZ = PROGRAM.timeZone;
const DAY_MS = 24 * 60 * 60 * 1000;

/** تاريخ اليوم بصيغة YYYY-MM-DD بتوقيت الرياض */
export function todayKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** رقم يوم الأسبوع بتوقيت الرياض: 0 الأحد … 6 السبت */
export function weekdayIndex(d: Date = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

export const ARABIC_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function dayName(d: Date = new Date()): string {
  return ARABIC_DAYS[weekdayIndex(d)];
}

/** تحويل مفتاح YYYY-MM-DD إلى تاريخ عند منتصف الليل بتوقيت الرياض (UTC+3 ثابت) */
export function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00+03:00`);
}

export function formatHijri(d: Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { timeZone: TZ, ...opts }).format(d);
}

export function formatGregorian(d: Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: TZ, ...opts }).format(d);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatShort(d: Date): string {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d);
}

export const programStart = keyToDate(PROGRAM.startDate);

/** رقم الأسبوع الحالي: -1 قبل البرنامج، 0 الافتتاحي، 1..12، 13 الختامي، 14 الاحتياطي، 15 بعد الانتهاء */
export function currentWeekNumber(now: Date = new Date()): number {
  const diff = Math.floor((now.getTime() - programStart.getTime()) / (7 * DAY_MS));
  if (diff < 0) return -1;
  if (diff > 14) return 15;
  return diff;
}

export function getWeek(n: number): Week | undefined {
  return WEEKS.find((w) => w.number === n);
}

export function currentWeek(now: Date = new Date()): Week | undefined {
  const n = currentWeekNumber(now);
  return getWeek(n);
}

/** موعد تسليم التقرير الأسبوعي: الخميس 22:00 بتوقيت الرياض للأسبوع المحدد */
export function reportDueDate(week: number): Date {
  const sat = new Date(programStart.getTime() + week * 7 * DAY_MS);
  return new Date(sat.getTime() + 5 * DAY_MS + 22 * 60 * 60 * 1000);
}

export function weekStart(week: number): Date {
  return new Date(programStart.getTime() + week * 7 * DAY_MS);
}

export function daysUntil(d: Date, now: Date = new Date()): number {
  return Math.ceil((d.getTime() - now.getTime()) / DAY_MS);
}

/** الأسابيع التطويرية التي يُتوقع فيها بطاقات قراءة وتقارير (0..12) */
export const ACTIVE_WEEKS = WEEKS.filter((w) => w.number >= 0 && w.number <= 12);
