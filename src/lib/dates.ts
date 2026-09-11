import { PROGRAM } from "./program";

const TZ = PROGRAM.timeZone;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * المنسّقات تُبنى مرة واحدة وتُعاد: إنشاء Intl.DateTimeFormat مكلف،
 * والصفحات تعرض عشرات التواريخ في القائمة الواحدة (سجل النشاط، الاتجاهات).
 */
const fmt = (() => {
  const cache = new Map<string, Intl.DateTimeFormat>();
  return (locale: string, opts: Intl.DateTimeFormatOptions) => {
    const key = locale + JSON.stringify(opts);
    let f = cache.get(key);
    if (!f) {
      f = new Intl.DateTimeFormat(locale, { timeZone: TZ, ...opts });
      cache.set(key, f);
    }
    return f;
  };
})();

/** تاريخ اليوم بصيغة YYYY-MM-DD بتوقيت الرياض */
export function todayKey(d: Date = new Date()): string {
  return fmt("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** رقم يوم الأسبوع بتوقيت الرياض: 0 الأحد … 6 السبت */
export function weekdayIndex(d: Date = new Date()): number {
  const name = fmt("en-US", { weekday: "short" }).format(d);
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
  return fmt("ar-SA-u-ca-islamic-umalqura-nu-latn", opts).format(d);
}

export function formatGregorian(d: Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  return fmt("ar-EG-u-nu-latn", opts).format(d);
}

export function formatDateTime(d: Date): string {
  return fmt("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatShort(d: Date): string {
  return fmt("ar-EG-u-nu-latn", { weekday: "short", day: "numeric", month: "short" }).format(d);
}

/**
 * موعد تسليم التقرير الأسبوعي: الخميس 22:00 بتوقيت الرياض،
 * محسوباً من تاريخ سبت الأسبوع نفسه (YYYY-MM-DD) لا من تاريخ ثابت في الخطة،
 * فيتبع تاريخ كل دفعة وأي تعديل يجريه مدير المشروع على الجدول.
 */
export function reportDueFrom(saturday: string): Date {
  return new Date(keyToDate(saturday).getTime() + 5 * DAY_MS + 22 * 60 * 60 * 1000);
}

export function daysUntil(d: Date, now: Date = new Date()): number {
  return Math.ceil((d.getTime() - now.getTime()) / DAY_MS);
}
