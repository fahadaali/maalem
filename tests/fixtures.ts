/**
 * بيانات اختبارٍ تُبنى في الذاكرة: جدول البرنامج من الخطة نفسها، ومشاركٌ فارغ يُملأ
 * بما يحتاجه كل اختبار. لا قاعدة بيانات ولا شبكة — الدوال المختبَرة نقية على صفوفها.
 */
import { CONTINUOUS_ASSESSMENT, COMPLETION_LEVELS, PROJECT_RUBRIC, WEEKS } from "../src/lib/program";
import { emptyParticipant, type ParticipantRows, type ProgramData } from "../src/lib/participant-data";
import type { LiveWeek } from "../src/lib/weeks";
import type { SchedulePause } from "../src/lib/pause";

/** لحظةٌ بتوقيت الرياض: بعد سبت الأسبوع بـ`days` يوماً عند الساعة `hour` */
export function at(gregorian: string, days = 0, hour = 12): Date {
  return new Date(new Date(`${gregorian}T${String(hour).padStart(2, "0")}:00:00+03:00`).getTime() + days * 86400000);
}

export function weeks(pause?: SchedulePause): LiveWeek[] {
  return WEEKS.map((w) => ({ ...w, pause }));
}

export const week = (ws: LiveWeek[], n: number) => ws.find((w) => w.number === n)!;

/** مهمةٌ لكل أسبوعٍ من الافتتاحي إلى الثاني عشر، موعدها خميسه العاشرة مساءً */
export function program(ws: LiveWeek[] = weeks()): ProgramData {
  return {
    cohortId: null,
    weeks: ws,
    assignments: ws.filter((w) => w.number >= 0 && w.number <= 12).map((w) => ({ id: `a${w.number}`, week: w.number, title: `مهمة ${w.number}`, dueAt: at(w.gregorian, 5, 22), competency: null })),
    quizzes: [],
    weekTasks: [],
    activities: [],
  };
}

/** مشاركٌ انضمّ قبل البرنامج بعشرة أيام، ما لم يُحدَّد انضمامه */
export function participant(joinedAt?: Date): ParticipantRows {
  const rows = emptyParticipant("u1");
  rows.user.createdAt = joinedAt ?? at(WEEKS[0].gregorian, -10);
  return rows;
}

/** تسليمٌ مقيَّم بسلّم 4/4/4/4 */
export function graded(assignmentId: string, when: Date, score = 4) {
  return { id: `s-${assignmentId}`, assignmentId, submittedAt: when, gradedAt: when, completeness: score, referencing: score, application: score, punctuality: score, feedback: null };
}

export function config(p: ProgramData, now: Date) {
  return {
    weights: CONTINUOUS_ASSESSMENT.map((c) => ({ key: c.key, label: c.component, points: c.points, tool: null, minimum: null, description: null })),
    projectRubric: PROJECT_RUBRIC.map((r) => ({ key: r.key, label: r.criterion, points: r.points, tool: null, minimum: null, description: null })),
    levels: COMPLETION_LEVELS.map((l) => ({ ...l })),
    expected: { weeks: 12, cards: 60, reports: 12, fieldHours: 12 },
    program: p,
    now,
  };
}
