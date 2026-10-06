import { cache } from "react";
import { db } from "./db";
import { activeCohortId, cohortWhere } from "./cohort";
import { getWeeks, type LiveWeek } from "./weeks";
import type { OpenReturn } from "./returns";

/**
 * سجلات المشارك كلها في رحلة واحدة إلى القاعدة، تتقاسمها الدرجة وحالات الأسابيع
 * والكفاءات و«مهامي» وعدّاد التنقّل.
 *
 * كان كلٌّ منها يجلب ما يحتاجه بنفسه: الدرجة أربعة عشر استعلاماً، وحالات الأسابيع
 * ستة، والرئيسية ثمانية عشر — وعدّاد المتأخر في الهيكل كان سيضيف سبعة عشر أخرى
 * إلى كل صفحة، والعامل يسقط عند خمسين طلباً فرعياً. فصار الجلب هنا مرة واحدة
 * في الطلب (`cache`)، والحساب دوالَّ نقية على صفوفه.
 *
 * `select` لا `include`: Prisma على SQLite يرسل لكل علاقة مضمَّنة استعلاماً مستقلاً.
 */

export type AssignmentRow = { id: string; week: number; title: string; dueAt: Date; competency: string | null };
export type QuizRow = { id: string; week: number | null; title: string; published: boolean; questions: number };
export type WeekTaskRow = { week: number; title: string; order: number };
export type CohortActivity = { id: string; userId: string; title: string };

/** ما يخصّ الدفعة لا المشارك: يُجلب مرة واحدة في الطلب مهما تعدّد المشاركون */
export type ProgramData = {
  cohortId: string | null;
  weeks: LiveWeek[];
  assignments: AssignmentRow[];
  quizzes: QuizRow[];
  weekTasks: WeekTaskRow[];
  /** أنشطة مشاركي الدفعة القيادية — منها يُعرف ما ينتظر تقييم كل مشارك */
  activities: CohortActivity[];
};

export const loadProgram = cache(async (): Promise<ProgramData> => {
  const scope = await cohortWhere();
  const [cohortId, weeks, assignments, quizzes, questionCounts, weekTasks, activities] = await Promise.all([
    activeCohortId(),
    getWeeks(),
    db.assignment.findMany({ where: scope, orderBy: [{ week: "asc" }, { dueAt: "asc" }], select: { id: true, week: true, title: true, dueAt: true, competency: true } }),
    db.quiz.findMany({ where: scope, orderBy: [{ week: "asc" }, { createdAt: "asc" }], select: { id: true, week: true, title: true, published: true } }),
    db.question.groupBy({ by: ["quizId"], _count: { _all: true } }),
    db.weekTask.findMany({ where: { ...scope, week: { gte: 0, lte: 12 } }, orderBy: [{ week: "asc" }, { order: "asc" }], select: { week: true, title: true, order: true } }),
    db.leadershipActivity.findMany({ where: { user: { role: "PARTICIPANT", active: true, ...scope } }, select: { id: true, userId: true, title: true } }),
  ]);
  const counts = new Map(questionCounts.map((q) => [q.quizId, q._count._all]));
  return {
    cohortId,
    weeks,
    assignments,
    quizzes: quizzes.map((q) => ({ ...q, questions: counts.get(q.id) ?? 0 })),
    weekTasks,
    activities,
  };
});

export type ParticipantRows = {
  user: {
    id: string;
    name: string;
    role: string;
    cohortId: string | null;
    createdAt: Date;
    charterAcceptedAt: Date | null;
    surveyDoneAt: Date | null;
    portfolioSubmittedAt: Date | null;
  };
  attendance: { week: number; type: string; status: string; participation: number | null; circleScore: number | null }[];
  cards: { id: string; date: Date; book: string; fromPage: number; toPage: number; reviewedAt: Date | null }[];
  attempts: { quizId: string; score: number; total: number }[];
  submissions: {
    id: string;
    assignmentId: string;
    submittedAt: Date;
    gradedAt: Date | null;
    completeness: number | null;
    referencing: number | null;
    application: number | null;
    punctuality: number | null;
  }[];
  reports: { id: string; week: number; submittedAt: Date; reviewedAt: Date | null }[];
  fieldLogs: { id: string; date: Date; hours: number; approvedAt: Date | null }[];
  activities: { id: string; title: string; createdAt: Date; evaluations: { c1: number; c2: number; c3: number; c4: number; c5: number }[] }[];
  /** معرّفات الأنشطة التي قيّمها هذا المشارك */
  evaluated: Set<string>;
  project: {
    id: string;
    status: string;
    topic: string;
    draftLink: string | null;
    finalLink: string | null;
    clarity: number | null;
    grounding: number | null;
    design: number | null;
    integration: number | null;
    presentation: number | null;
  } | null;
  mentorEvals: { regularity: number; engagement: number; application: number; conduct: number; growth: number }[];
  plan: { id: string; updatedAt: Date; reviewedAt: Date | null } | null;
  tadabbur: number;
  diagnostics: string[];
  /** الإرجاعات المفتوحة عليه — ما فيها لا يُحتسب حتى يُعاد */
  returns: OpenReturn[];
  /** أبعد تمديد معتمد لكل مهمة */
  extensions: Map<string, Date>;
};

const SUBMISSION_SELECT = { id: true, userId: true, assignmentId: true, submittedAt: true, gradedAt: true, completeness: true, referencing: true, application: true, punctuality: true } as const;

/**
 * صفوف مجموعة مشاركين باستعلام واحد لكل جدول، مهما كان عددهم. المشارك الواحد
 * يمرّ من هنا أيضاً (`loadParticipant`)، فلا يفترق حساب الفرد عن حساب الدفعة.
 */
export async function loadParticipants(ids: string[]): Promise<Map<string, ParticipantRows>> {
  const out = new Map<string, ParticipantRows>();
  if (ids.length === 0) return out;
  const inIds = { userId: { in: ids } };
  const [users, attendance, cards, attempts, submissions, reports, fieldLogs, activities, peerEvals, projects, mentorEvals, plans, tadabbur, diagnostics, returns, extensions] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true, cohortId: true, createdAt: true, charterAcceptedAt: true, surveyDoneAt: true, portfolioSubmittedAt: true } }),
    db.attendance.findMany({ where: inIds, select: { userId: true, week: true, type: true, status: true, participation: true, circleScore: true } }),
    db.readingCard.findMany({ where: inIds, orderBy: { date: "asc" }, select: { id: true, userId: true, date: true, book: true, fromPage: true, toPage: true, reviewedAt: true } }),
    db.quizAttempt.findMany({ where: inIds, select: { userId: true, quizId: true, score: true, total: true } }),
    db.submission.findMany({ where: inIds, select: SUBMISSION_SELECT }),
    db.weeklyReport.findMany({ where: inIds, select: { id: true, userId: true, week: true, submittedAt: true, reviewedAt: true } }),
    db.fieldLog.findMany({ where: inIds, select: { id: true, userId: true, date: true, hours: true, approvedAt: true } }),
    db.leadershipActivity.findMany({ where: inIds, orderBy: { createdAt: "asc" }, select: { id: true, userId: true, title: true, createdAt: true } }),
    // ما قيّموه وما قُيّموا به في استعلام واحد: شرطُ العلاقة في `where` يُضمّ في العبارة نفسها
    db.peerEvaluation.findMany({
      where: { OR: [{ evaluatorId: { in: ids } }, { activity: { userId: { in: ids } } }] },
      select: { activityId: true, evaluatorId: true, c1: true, c2: true, c3: true, c4: true, c5: true },
    }),
    db.graduationProject.findMany({ where: inIds, select: { id: true, userId: true, status: true, topic: true, draftLink: true, finalLink: true, clarity: true, grounding: true, design: true, integration: true, presentation: true } }),
    db.mentorEvaluation.findMany({ where: inIds, select: { userId: true, regularity: true, engagement: true, application: true, conduct: true, growth: true } }),
    db.learningPlan.findMany({ where: inIds, select: { id: true, userId: true, updatedAt: true, reviewedAt: true } }),
    db.tadabburStop.groupBy({ by: ["userId"], where: inIds, _count: { _all: true } }),
    db.diagnostic.findMany({ where: inIds, select: { userId: true, stage: true } }),
    db.itemReturn.findMany({ where: { ...inIds, resolvedAt: null }, orderBy: { returnedAt: "asc" }, select: { id: true, userId: true, kind: true, recordId: true, note: true, returnedAt: true, returnedBy: true } }),
    db.excuseRequest.findMany({ where: { ...inIds, kind: "EXTENSION", status: "APPROVED", untilAt: { not: null }, assignmentId: { not: null } }, select: { userId: true, assignmentId: true, untilAt: true } }),
  ]);

  // الصفوف تحمل `userId` زائداً على أنواعها، ولا ضير: تُقرأ ولا تُكتب
  const by = <T extends { userId: string }>(rows: T[], id: string) => rows.filter((r) => r.userId === id);

  for (const u of users) {
    const mine = by(activities, u.id);
    const mineIds = new Set(mine.map((a) => a.id));
    const ext = new Map<string, Date>();
    for (const e of by(extensions, u.id)) {
      if (!e.assignmentId || !e.untilAt) continue;
      const prev = ext.get(e.assignmentId);
      if (!prev || e.untilAt > prev) ext.set(e.assignmentId, e.untilAt);
    }
    const project = projects.find((p) => p.userId === u.id);
    const plan = plans.find((p) => p.userId === u.id);
    out.set(u.id, {
      user: u,
      attendance: by(attendance, u.id),
      cards: by(cards, u.id),
      attempts: by(attempts, u.id),
      submissions: by(submissions, u.id),
      reports: by(reports, u.id),
      fieldLogs: by(fieldLogs, u.id),
      activities: mine.map((a) => ({
        ...a,
        evaluations: peerEvals.filter((e) => e.activityId === a.id).map(({ c1, c2, c3, c4, c5 }) => ({ c1, c2, c3, c4, c5 })),
      })),
      evaluated: new Set(peerEvals.filter((e) => e.evaluatorId === u.id && !mineIds.has(e.activityId)).map((e) => e.activityId)),
      project: project ?? null,
      mentorEvals: by(mentorEvals, u.id),
      plan: plan ?? null,
      tadabbur: tadabbur.find((t) => t.userId === u.id)?._count._all ?? 0,
      diagnostics: by(diagnostics, u.id).map((d) => d.stage),
      returns: by(returns, u.id),
      extensions: ext,
    });
  }
  return out;
}

/** صفوفٌ فارغة لحسابٍ لا سجلات له أو لم يُعثر عليه: الدرجة صفر لا خطأ */
export function emptyParticipant(id: string): ParticipantRows {
  return {
    user: { id, name: "—", role: "PARTICIPANT", cohortId: null, createdAt: new Date(0), charterAcceptedAt: null, surveyDoneAt: null, portfolioSubmittedAt: null },
    attendance: [], cards: [], attempts: [], submissions: [], reports: [], fieldLogs: [], activities: [], evaluated: new Set(),
    project: null, mentorEvals: [], plan: null, tadabbur: 0, diagnostics: [], returns: [], extensions: new Map(),
  };
}

/** صفوف مشاركٍ واحد، مرة واحدة في الطلب مهما تعدّد من يقرؤها */
export const loadParticipant = cache(async (userId: string): Promise<ParticipantRows | null> => {
  return (await loadParticipants([userId])).get(userId) ?? null;
});

/** الموعد الساري لمشاركٍ في مهمة: الأبعد من موعدها وتمديده المعتمد — فالتمديد لا يقصّر موعداً */
export function dueFor(a: { id: string; dueAt: Date }, extensions: Map<string, Date>): Date {
  const e = extensions.get(a.id);
  return e && e > a.dueAt ? e : a.dueAt;
}
