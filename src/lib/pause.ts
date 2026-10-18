import { calendarDays, formatHijri, keyToDate, todayKey, weekdayIndex } from "./dates";

/**
 * الإيقاف المؤقت للدفعة واستئنافها.
 *
 * كان البرنامج إذا توقّف لإجازةٍ أو ظرفٍ يمضي أسبوعه الحالي بتاريخه، وتتابع
 * تذكيراته، ويتراكم «متأخر» على المشاركين عن أيامٍ لم يكن فيها برنامجٌ أصلاً.
 *
 * والقاعدة هنا اثنتان:
 * - أثناء الإيقاف يقف زمن البرنامج عند لحظة بدئه (`since`): الأسبوع الحالي هو
 *   ما كان، وما فات موعده قبلها متأخرٌ بعدّادٍ واقف، وما موعده بعدها «موقوف».
 * - عند الاستئناف تُكتب الإزاحة — أسابيع كاملة فيبقى اللقاء يوم سبت — في القاعدة
 *   نفسها على كل ما يبدأ بعد الإيقاف: الأسابيع والمهام والتمديدات والتذكيرات.
 *   وأما الأسبوع الذي كان جارياً فلا تُنقل بدايته — ما سُجّل فيه قبل الإيقاف منسوبٌ
 *   إليه بتاريخه — فتُزاح مواعيده الواقعة بعد الإيقاف حساباً من السجل (`afterPauses`).
 *
 * والدوال هنا نقية، تُحمَل حالتها على الجدول نفسه (`LiveWeek.pause`)، فتقرؤها
 * كل دالة جدولة من داخلها بلا تمريرٍ في عشرات المواضع.
 */

const DAY = 86400000;
export const WEEK_MS = 7 * DAY;

/** بندٌ من بنود الإزاحة بقيمته الجديدة المطلقة لا بفرقها: إعادة كتابته لا تُزيح مرتين */
export type ShiftItem =
  | { m: "week"; id: string; number: number; from: string; to: string; hijri: string }
  | { m: "start"; id: string; from: string; to: string }
  | { m: "assignment"; id: string; title: string; from: string; to: string }
  | { m: "extension"; id: string; from: string; to: string }
  | { m: "reminder"; id: string; title: string; from: string; to: string };

export type ShiftCounts = { weeks: number; tasks: number; extensions: number; reminders: number };

/** إيقافٌ انتهى، كما يُحفظ في `Cohort.pauses` */
export type PauseEntry = {
  /** بدايته ونهايته ISO */
  at: string;
  end: string;
  /** مقدار الإزاحة بالأيام — مضاعفٌ للسبعة */
  shiftDays: number;
  /** سبت الاستئناف الذي اختاره المدير */
  resumeOn: string;
  reason?: string | null;
  until?: string | null;
  by: string;
  resumedBy: string;
  moved: ShiftCounts;
  /** ما لم يُكتب بعد من الإزاحة — يُكمله «أكمل الإزاحة» إن انقطع الطلب */
  pending?: ShiftItem[];
};

/** حالة الإيقاف كما يقرؤها الجدول */
export type SchedulePause = {
  /** بداية الإيقاف المفتوح (ms) — فارغةً: الدفعة تعمل */
  since: number | null;
  reason: string | null;
  until: string | null;
  /** الإيقافات المنتهية بترتيبها: بدايتها ونهايتها وإزاحتها */
  past: { at: number; end: number; ms: number }[];
};

/** السجلّ قراءةً لا ترمي: نصٌّ تالف لا يُسقط كل صفحةٍ تقرأ الجدول */
export function parsePauseLog(json: string | null | undefined): PauseEntry[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((e) => e && typeof e.at === "string" && typeof e.end === "string") : [];
  } catch {
    return [];
  }
}

/** حالة الإيقاف من صفّ الدفعة — ولا شيء لدفعةٍ لم تُوقَف قط، فلا كلفة على الحساب */
export function schedulePause(row: { pausedAt: Date | null; pauseReason: string | null; pauseUntil: string | null; pauses: string }): SchedulePause | undefined {
  const past = parsePauseLog(row.pauses)
    .map((e) => ({ at: Date.parse(e.at), end: Date.parse(e.end), ms: (e.shiftDays || 0) * DAY }))
    .filter((e) => Number.isFinite(e.at) && Number.isFinite(e.end))
    .sort((a, b) => a.at - b.at);
  if (!row.pausedAt && past.length === 0) return undefined;
  return { since: row.pausedAt ? row.pausedAt.getTime() : null, reason: row.pauseReason, until: row.pauseUntil, past };
}

/** ساعة البرنامج: الآن، أو لحظة بدء الإيقاف ما دام مفتوحاً */
export function programClock(now: Date, p: SchedulePause | undefined): Date {
  return p?.since != null && p.since < now.getTime() ? new Date(p.since) : now;
}

/** بداية الأسبوع: منتصف ليل سبته بتوقيت الرياض */
export function weekStartMs(w: { gregorian: string }): number {
  return keyToDate(w.gregorian).getTime();
}

/** أسبوعٌ يبدأ بعد بدء الإيقاف المفتوح: تاريخه مؤقت حتى يُحدَّد عند الاستئناف */
export function isHeld(w: { gregorian: string; pause?: SchedulePause }): boolean {
  return w.pause?.since != null && weekStartMs(w) > w.pause.since;
}

/**
 * موعدٌ مشتقٌّ بعد الإيقافات المنتهية. `anchor` ما اشتُقّ منه: بداية الأسبوع، أو
 * تاريخ الانضمام. كل إيقافٍ بدأ بعد المرساة ولم يسبقه الموعد يُزيحه بإزاحته،
 * بترتيبها. والأسبوع الذي نُقلت بدايته فعلاً بدايته بعد الإيقاف، فلا يُزاح مرتين.
 */
export function afterPauses(raw: Date, anchor: number, p: SchedulePause | undefined): Date {
  if (!p?.past.length) return raw;
  let d = raw.getTime();
  for (const e of p.past) if (anchor < e.at && e.at <= d) d += e.ms;
  return d === raw.getTime() ? raw : new Date(d);
}

/** موعدٌ يقع في الإيقاف المفتوح أو بعده: لا يتأخر ولا يُسلَّم حتى الاستئناف */
export function isFrozen(due: Date | null, p: SchedulePause | undefined): boolean {
  return p?.since != null && due != null && due.getTime() >= p.since;
}

/** أيام التقويم في الرياض الواقعة داخل الإيقافات بين لحظتين */
export function pausedDays(from: Date, to: Date, p: SchedulePause | undefined): number {
  if (!p) return 0;
  const spans = [...p.past.map((e) => [e.at, e.end]), ...(p.since != null ? [[p.since, to.getTime()]] : [])];
  let days = 0;
  for (const [a, b] of spans) {
    const s = Math.max(a, from.getTime());
    const e = Math.min(b, to.getTime());
    if (e > s) days += calendarDays(new Date(s), new Date(e));
  }
  return days;
}

/**
 * أيام التأخر بأيام التقويم بعد طرح أيام الإيقاف: من تأخّر يومين ثم أُوقف البرنامج
 * أسبوعاً يبقى متأخراً يومين، لا تسعة. وأثناء الإيقاف يقف العدّاد عند بدايته.
 */
export function lateDays(due: Date, now: Date, p: SchedulePause | undefined): number {
  const clock = programClock(now, p);
  return Math.max(0, calendarDays(due, clock) - pausedDays(due, clock, p));
}

/**
 * الوقت المقابل في الأسبوع الأصلي لتذكيرات الروتين، في الأسبوع الذي كان جارياً
 * عند الإيقاف ثم امتدّ بالإزاحة. أيامٌ بعد الاستئناف تقابل ما لم يمرّ منه قبل
 * الإيقاف (`now − الإزاحة`)، وما قبلها فاصلٌ بلا روتين (`null`): فلا يتكرر تذكير
 * لقاء السبت ولا حلقة الثلاثاء، ويأتي تذكير التقرير يوم موعده الجديد.
 */
export function routineClock(w: { gregorian: string; pause?: SchedulePause }, now: Date): Date | null {
  const p = w.pause;
  if (!p?.past.length) return now;
  const anchor = weekStartMs(w);
  let v = now.getTime();
  for (const e of [...p.past].reverse()) {
    if (e.at <= anchor) continue;
    if (v >= e.at + e.ms) v -= e.ms;
    else if (v >= e.at) return null;
  }
  return new Date(v);
}

export function isSaturdayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(keyToDate(key).getTime()) && weekdayIndex(keyToDate(key)) === 6 && todayKey(keyToDate(key)) === key;
}

function addDays(key: string, days: number): string {
  return todayKey(new Date(keyToDate(key).getTime() + days * DAY));
}

/**
 * السبت المرجعي للإزاحة: بداية أول أسبوعٍ لم يبدأ قبل الإيقاف، وبعده تُعدّ
 * الإزاحة. وإن لم يبقَ أسبوعٌ — أوقف في الختامي — فأول سبتٍ بعد يوم الإيقاف.
 */
export function referenceSaturday(weeks: { gregorian: string }[], at: Date): string {
  const atKey = todayKey(at);
  const next = weeks.map((w) => w.gregorian).filter((g) => g > atKey).sort()[0];
  if (next) return next;
  const wd = weekdayIndex(at);
  return addDays(atKey, (6 - wd + 7) % 7 || 7);
}

/**
 * سبت الاستئناف المقترح: العودة المتوقعة إن كُتبت وصلحت، وإلا السبت المرجعي
 * مُزاحاً بمدة الإيقاف مقرَّبةً إلى أسابيع كاملة — فما كان باقياً من وقت
 * الأسبوع الجاري لحظة الإيقاف يبقى باقياً بعد العودة.
 */
export function suggestResume(ref: string, at: Date, now: Date, until?: string | null): string {
  if (until && !resumeError(until, ref, now)) return until;
  const weeks = Math.max(0, Math.ceil((now.getTime() - at.getTime()) / WEEK_MS));
  let s = addDays(ref, weeks * 7);
  while (s < todayKey(now)) s = addDays(s, 7);
  return s;
}

/** سبت الاستئناف صالح؟ يعيد سبب الرفض أو `null` */
export function resumeError(resumeOn: string, ref: string, now: Date): string | null {
  if (!isSaturdayKey(resumeOn)) return "سبت الاستئناف يجب أن يكون يوم سبت";
  if (resumeOn < todayKey(now)) return "سبت الاستئناف لا يكون في الماضي";
  if (resumeOn < ref) return "سبت الاستئناف لا يسبق موعد الأسبوع التالي في الجدول";
  return null;
}

/** الإزاحة بالأيام بين السبت المرجعي وسبت الاستئناف */
export function shiftDaysFor(ref: string, resumeOn: string): number {
  return Math.round((keyToDate(resumeOn).getTime() - keyToDate(ref).getTime()) / DAY);
}

/**
 * بنود الإزاحة: كل ما يبدأ أو يحين في الإيقاف أو بعده يُزاح بالأيام نفسها.
 * - الأسابيع التي تبدأ بعد يوم الإيقاف، بتاريخها الهجري محسوباً من جديد.
 * - تاريخ انطلاق الدفعة إن أُوقفت قبل لقائها الافتتاحي.
 * - المهام، والتمديدات غير المرفوضة، والتذكيرات التي لم تُرسل.
 */
export function planResume(input: {
  at: Date;
  shiftDays: number;
  cohort: { id: string; startDate: string };
  weeks: { id: string; number: number; gregorian: string }[];
  assignments: { id: string; title: string; dueAt: Date }[];
  extensions: { id: string; untilAt: Date | null }[];
  reminders: { id: string; title: string; sendAt: Date }[];
}): ShiftItem[] {
  const { at, shiftDays } = input;
  if (shiftDays <= 0) return [];
  const atKey = todayKey(at);
  const ms = shiftDays * DAY;
  const later = (d: Date) => new Date(d.getTime() + ms).toISOString();
  const items: ShiftItem[] = [];
  for (const w of [...input.weeks].sort((a, b) => a.number - b.number)) {
    if (w.gregorian <= atKey) continue;
    const to = addDays(w.gregorian, shiftDays);
    items.push({ m: "week", id: w.id, number: w.number, from: w.gregorian, to, hijri: formatHijri(keyToDate(to), { day: "numeric", month: "long" }) });
  }
  if (input.cohort.startDate > atKey) items.push({ m: "start", id: input.cohort.id, from: input.cohort.startDate, to: addDays(input.cohort.startDate, shiftDays) });
  for (const a of input.assignments) if (a.dueAt.getTime() >= at.getTime()) items.push({ m: "assignment", id: a.id, title: a.title, from: a.dueAt.toISOString(), to: later(a.dueAt) });
  for (const e of input.extensions) if (e.untilAt && e.untilAt.getTime() >= at.getTime()) items.push({ m: "extension", id: e.id, from: e.untilAt.toISOString(), to: later(e.untilAt) });
  for (const r of input.reminders) if (r.sendAt.getTime() >= at.getTime()) items.push({ m: "reminder", id: r.id, title: r.title, from: r.sendAt.toISOString(), to: later(r.sendAt) });
  return items;
}

export function countShift(items: ShiftItem[]): ShiftCounts {
  return {
    weeks: items.filter((i) => i.m === "week").length,
    tasks: items.filter((i) => i.m === "assignment").length,
    extensions: items.filter((i) => i.m === "extension").length,
    reminders: items.filter((i) => i.m === "reminder").length,
  };
}

/** «أسبوعاً واحداً» و«أسبوعين» و«3 أسابيع» */
export function weeksText(days: number): string {
  const n = Math.round(days / 7);
  if (n === 1) return "أسبوعاً واحداً";
  if (n === 2) return "أسبوعين";
  if (n <= 10) return `${n} أسابيع`;
  return `${n} أسبوعاً`;
}
