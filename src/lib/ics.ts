import { db } from "./db";
import { WEEKS } from "./program";
import { programStart } from "./dates";

const DAY_MS = 24 * 60 * 60 * 1000;

export const SCHEDULE_KEYS = {
  sessionTime: "schedule:sessionTime",
  sessionMinutes: "schedule:sessionMinutes",
  circleTime: "schedule:circleTime",
  circleMinutes: "schedule:circleMinutes",
} as const;

export const SCHEDULE_DEFAULTS = { sessionTime: "16:00", sessionMinutes: 120, circleTime: "20:00", circleMinutes: 60 };

export type ScheduleTimes = typeof SCHEDULE_DEFAULTS;

export async function scheduleTimes(): Promise<ScheduleTimes> {
  try {
    const rows = await db.setting.findMany({ where: { key: { in: Object.values(SCHEDULE_KEYS) } } });
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const time = (v: string | undefined, d: string) => (v && /^\d{2}:\d{2}$/.test(v) ? v : d);
    const mins = (v: string | undefined, d: number) => (v && Number(v) > 0 ? Number(v) : d);
    return {
      sessionTime: time(s[SCHEDULE_KEYS.sessionTime], SCHEDULE_DEFAULTS.sessionTime),
      sessionMinutes: mins(s[SCHEDULE_KEYS.sessionMinutes], SCHEDULE_DEFAULTS.sessionMinutes),
      circleTime: time(s[SCHEDULE_KEYS.circleTime], SCHEDULE_DEFAULTS.circleTime),
      circleMinutes: mins(s[SCHEDULE_KEYS.circleMinutes], SCHEDULE_DEFAULTS.circleMinutes),
    };
  } catch {
    return SCHEDULE_DEFAULTS;
  }
}

function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** لحظة بتوقيت الرياض من يوم البرنامج وساعة بصيغة HH:MM */
function riyadh(base: Date, offsetDays: number, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  // base هو منتصف ليل يوم البرنامج بتوقيت الرياض، فتُضاف الساعة كما هي
  return new Date(base.getTime() + offsetDays * DAY_MS + h * 3600_000 + m * 60_000);
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** طيّ السطور إلى 75 ثمانية كما يوجب RFC 5545 */
function fold(line: string) {
  const bytes = [...line];
  if (bytes.length <= 74) return line;
  const parts: string[] = [];
  let cur = "";
  for (const ch of bytes) {
    if (cur.length >= 70) { parts.push(cur); cur = " "; }
    cur += ch;
  }
  parts.push(cur);
  return parts.join("\r\n");
}

type Event = { uid: string; start: Date; minutes: number; summary: string; description?: string; location?: string; url?: string };

function vevent(e: Event, now: Date) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(new Date(e.start.getTime() + e.minutes * 60_000))}`,
    `SUMMARY:${escapeText(e.summary)}`,
  ];
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  lines.push("BEGIN:VALARM", "TRIGGER:-PT60M", "ACTION:DISPLAY", "DESCRIPTION:تذكير", "END:VALARM", "END:VEVENT");
  return lines.map(fold).join("\r\n");
}

/** تقويم مواعيد البرنامج لمشارك بعينه: اللقاءات، والحلقات، ومواعيد التسليم. */
export async function buildCalendar(userId: string, cohortId: string | null, appUrl: string): Promise<string> {
  const now = new Date();
  const times = await scheduleTimes();
  let weeks: { number: number; label: string; session: string; circle: string; task: string; meetingPlace?: string | null; remoteUrl?: string | null }[] = WEEKS;
  try {
    const rows = await db.programWeek.findMany({ where: cohortId ? { cohortId } : {}, orderBy: { number: "asc" } });
    if (rows.length) weeks = rows;
  } catch {
    // القاعدة غير مهيأة بعد
  }

  const events: Event[] = [];
  for (const w of weeks) {
    if (w.number < 0 || w.number > 13) continue;
    events.push({
      uid: `maalem-session-${w.number}-${userId}@maalem`,
      start: riyadh(programStart, w.number * 7, times.sessionTime),
      minutes: times.sessionMinutes,
      summary: `لقاء حضوري — الأسبوع ${w.label}`,
      description: w.session,
      location: w.meetingPlace ?? undefined,
    });
    events.push({
      uid: `maalem-circle-${w.number}-${userId}@maalem`,
      start: riyadh(programStart, w.number * 7 + 3, times.circleTime),
      minutes: times.circleMinutes,
      summary: `حلقة نقاش عن بُعد — الأسبوع ${w.label}`,
      description: w.circle,
      url: w.remoteUrl ?? undefined,
    });
    if (w.number <= 12) {
      events.push({
        uid: `maalem-report-${w.number}-${userId}@maalem`,
        start: riyadh(programStart, w.number * 7 + 5, "21:30"),
        minutes: 30,
        summary: `تسليم التقرير الأسبوعي — الأسبوع ${w.label}`,
        description: `المهمة: ${w.task}`,
        url: `${appUrl}/app/reports/${w.number}`,
      });
    }
  }

  try {
    const assignments = await db.assignment.findMany({ where: cohortId ? { cohortId } : {}, orderBy: { dueAt: "asc" } });
    for (const a of assignments) {
      if (!a.dueAt) continue;
      events.push({
        uid: `maalem-task-${a.id}-${userId}@maalem`,
        start: new Date(a.dueAt.getTime() - 30 * 60_000),
        minutes: 30,
        summary: `موعد تسليم: ${a.title}`,
        url: `${appUrl}/app/tasks/${a.id}`,
      });
    }
  } catch {
    // لا مهام بعد
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//معالم التربية//برنامج تأهيل المشرفين//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold("X-WR-CALNAME:معالم التربية"),
    "X-WR-TIMEZONE:Asia/Riyadh",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    ...events.map((e) => vevent(e, now)),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
