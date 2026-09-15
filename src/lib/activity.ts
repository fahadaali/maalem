import { db } from "./db";
import { participantsWhere } from "./cohort";
import { ATTENDANCE_LABELS } from "./utils";
import { EXCUSE_KINDS } from "./excuses";
import { getWeeks } from "./weeks";
import { keyToDate } from "./dates";

/**
 * مركز الأنشطة: كل ما يُدخَل في المنصة — من المشاركين ومن مدير المشروع — في
 * قائمة واحدة، مع تراجعٍ عن الخاطئ منه.
 *
 * يُجمع من سجلات المنصة نفسها لا من جدول أحداث، فلا يتخلّف عن الواقع ولا يحتاج
 * كتابةً ثانية مع كل إدخال. ولكل نوعٍ ثلاثة أعمال: عرضُ أحدثه، والتراجع عنه،
 * وإعادته من لقطته — والثلاثة في مكان واحد فلا يُضاف نوعٌ ناقصَ أحدها.
 */

export type ActivityBy = "PARTICIPANT" | "ADMIN";

export type ActivityItem = {
  kind: ActivityKind;
  /** معرّف السجل في جدوله */
  id: string;
  at: Date;
  userId: string;
  userName: string;
  title: string;
  detail?: string;
  href?: string;
};

/** لقطة الإدخال قبل رفعه، منها يُعاد */
export type Snapshot = { label: string; detail?: string; at: Date; userId: string; userName: string; payload: unknown };

type Kind = {
  label: string;
  /** مَن أدخله: المشارك بنفسه، أم مدير المشروع عليه */
  by: ActivityBy;
  /** ماذا يحدث عند التراجع، كما يُشرح للمدير قبل أن يضغط */
  undoNote: string;
  list: (who: object, take: number) => Promise<ActivityItem[]>;
  undo: (id: string) => Promise<Snapshot | null>;
  restore: (payload: Record<string, unknown>) => Promise<void>;
};

/** تاريخٌ من حمولة JSON */
const d = (v: unknown): Date => new Date(String(v));
const dn = (v: unknown): Date | null => (v ? new Date(String(v)) : null);
const s = (v: unknown): string => String(v ?? "");
const sn = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const n = (v: unknown): number => Number(v);
const nn = (v: unknown): number | null => (v == null ? null : Number(v));
const cut = (t: string, max = 120) => (t.length > max ? `${t.slice(0, max)}…` : t);

/**
 * يوم لقاء الأسبوع: صفّ الحضور لا زمن له في القاعدة، فيُؤرَّخ بتاريخ أسبوعه من
 * جدول الدفعة — السبت للحضوري والثلاثاء للحلقة — كما يفعل سجل نشاط المشارك.
 * والجدول يُقرأ من getWeeks المخزَّنة في الطلب، فلا رحلة ثانية إلى القاعدة.
 */
async function meetingDay(week: number, type: string): Promise<Date> {
  const w = (await getWeeks()).find((x) => x.number === week);
  if (!w) return new Date(0);
  return new Date(keyToDate(w.gregorian).getTime() + (type === "INPERSON" ? 0 : 3) * 86400000);
}

/** بند لكل نوع، مبنيٌّ من صفٍّ فيه اسم صاحبه */
type Row = { id: string; user: { name: string } | null; userId: string };
const item = (kind: ActivityKind, r: Row, at: Date, title: string, detail?: string, href?: string): ActivityItem => ({
  kind, id: r.id, at, userId: r.userId, userName: r.user?.name ?? "—", title, detail, href,
});

const withUser = { user: { select: { name: true } } } as const;

export const ACTIVITY_KINDS: Record<string, Kind> = {
  // ——— ما يُدخله المشاركون ———
  READING_CARD: {
    label: "بطاقة قراءة",
    by: "PARTICIPANT",
    undoNote: "تُحذف البطاقة من سجل قراءته",
    list: async (who, take) =>
      (await db.readingCard.findMany({ where: { user: who }, include: withUser, orderBy: { createdAt: "desc" }, take }))
        .map((r) => item("READING_CARD", r, r.createdAt, `بطاقة قراءة — ${r.book}`, `الصفحات ${r.fromPage}–${r.toPage} · ${cut(r.benefit)}`)),
    undo: async (id) => {
      const r = await db.readingCard.findUnique({ where: { id }, include: withUser });
      if (!r) return null;
      await db.readingCard.delete({ where: { id } });
      return { label: `بطاقة قراءة — ${r.book}`, detail: `الصفحات ${r.fromPage}–${r.toPage}`, at: r.createdAt, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.readingCard.create({ data: { id: s(p.id), userId: s(p.userId), date: d(p.date), book: s(p.book), fromPage: n(p.fromPage), toPage: n(p.toPage), benefit: s(p.benefit), question: sn(p.question), createdAt: d(p.createdAt) } });
    },
  },

  WEEKLY_REPORT: {
    label: "التقرير الأسبوعي",
    by: "PARTICIPANT",
    undoNote: "يُحذف التقرير كاملاً فيستطيع المشارك تسليمه من جديد",
    list: async (who, take) =>
      (await db.weeklyReport.findMany({ where: { user: who }, include: withUser, orderBy: { submittedAt: "desc" }, take }))
        .map((r) => item("WEEKLY_REPORT", r, r.submittedAt, `تقرير الأسبوع ${r.week}`, cut(r.benefits), "/admin/reports")),
    undo: async (id) => {
      const r = await db.weeklyReport.findUnique({ where: { id }, include: withUser });
      if (!r) return null;
      await db.weeklyReport.delete({ where: { id } });
      return { label: `تقرير الأسبوع ${r.week}`, detail: cut(r.benefits), at: r.submittedAt, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.weeklyReport.create({ data: { id: s(p.id), userId: s(p.userId), week: n(p.week), reading: s(p.reading), benefits: s(p.benefits), taskProgress: s(p.taskProgress), fieldNote: sn(p.fieldNote), quizResult: sn(p.quizResult), application: sn(p.application), difficulty: sn(p.difficulty), submittedAt: d(p.submittedAt), feedback: sn(p.feedback), reviewedAt: dn(p.reviewedAt) } });
    },
  },

  REFLECTION: {
    label: "التأمل",
    by: "PARTICIPANT",
    undoNote: "تُحذف المدونة من دفتر تأمله",
    list: async (who, take) =>
      (await db.reflection.findMany({ where: { user: who }, include: withUser, orderBy: { date: "desc" }, take }))
        .map((r) => item("REFLECTION", r, r.date, "مدوّنة تأمل", cut(r.text))),
    undo: async (id) => {
      const r = await db.reflection.findUnique({ where: { id }, include: withUser });
      if (!r) return null;
      await db.reflection.delete({ where: { id } });
      return { label: "مدوّنة تأمل", detail: cut(r.text), at: r.date, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.reflection.create({ data: { id: s(p.id), userId: s(p.userId), date: d(p.date), text: s(p.text) } });
    },
  },

  SUBMISSION: {
    label: "تسليم مهمة",
    by: "PARTICIPANT",
    undoNote: "يُحذف التسليم ودرجته إن قُيّم، وتبقى مرفقاته فتعود معه",
    list: async (who, take) =>
      (await db.submission.findMany({ where: { user: who }, include: { ...withUser, assignment: { select: { title: true } } }, orderBy: { submittedAt: "desc" }, take }))
        .map((r) => item("SUBMISSION", r, r.submittedAt, `سلّم «${r.assignment.title}»`, cut(r.content), `/admin/tasks/${r.assignmentId}`)),
    undo: async (id) => {
      const r = await db.submission.findUnique({ where: { id }, include: { ...withUser, assignment: { select: { title: true } } } });
      if (!r) return null;
      // المرفقات منسوبة إلى المهمة لا إلى صفّ التسليم، فتبقى في مكانها ويجدها التسليم حين يُعاد
      await db.submission.delete({ where: { id } });
      return { label: `تسليم «${r.assignment.title}»`, detail: cut(r.content), at: r.submittedAt, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.submission.create({ data: { id: s(p.id), assignmentId: s(p.assignmentId), userId: s(p.userId), content: s(p.content), link: sn(p.link), submittedAt: d(p.submittedAt), completeness: nn(p.completeness), referencing: nn(p.referencing), application: nn(p.application), punctuality: nn(p.punctuality), feedback: sn(p.feedback), gradedAt: dn(p.gradedAt) } });
    },
  },

  FIELD_LOG: {
    label: "سجل معايشة",
    by: "PARTICIPANT",
    undoNote: "يُحذف السجل وساعاته، وتبقى شواهده فتعود معه",
    list: async (who, take) =>
      (await db.fieldLog.findMany({ where: { user: who }, include: withUser, orderBy: { createdAt: "desc" }, take }))
        .map((r) => item("FIELD_LOG", r, r.createdAt, `${r.hours} ساعة مع ${r.mentorName}`, cut(r.note), "/admin/field")),
    undo: async (id) => {
      const r = await db.fieldLog.findUnique({ where: { id }, include: withUser });
      if (!r) return null;
      // لا تُحذف الشواهد مع السجل: حذفها يمنع إعادته كما كان
      await db.fieldLog.delete({ where: { id } });
      return { label: `معايشة ${r.hours} ساعة مع ${r.mentorName}`, detail: cut(r.note), at: r.createdAt, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.fieldLog.create({ data: { id: s(p.id), userId: s(p.userId), date: d(p.date), hours: n(p.hours), mentorName: s(p.mentorName), note: s(p.note), approvedAt: dn(p.approvedAt), approvedBy: sn(p.approvedBy), createdAt: d(p.createdAt) } });
    },
  },

  LEADERSHIP: {
    label: "نشاط قيادي",
    by: "PARTICIPANT",
    undoNote: "يُحذف النشاط وتقييمات أقرانه معه، وتعود جميعاً عند الإعادة",
    list: async (who, take) =>
      (await db.leadershipActivity.findMany({ where: { user: who }, include: withUser, orderBy: { createdAt: "desc" }, take }))
        .map((r) => item("LEADERSHIP", r, r.createdAt, r.title, r.report ? cut(r.report) : undefined)),
    undo: async (id) => {
      const r = await db.leadershipActivity.findUnique({ where: { id }, include: { ...withUser, evaluations: true } });
      if (!r) return null;
      // تقييمات الأقران تُحذف تِبعاً للنشاط، فتُحفظ في اللقطة لتعود معه
      await db.leadershipActivity.delete({ where: { id } });
      return { label: `نشاط قيادي — ${r.title}`, detail: r.report ? cut(r.report) : undefined, at: r.createdAt, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.leadershipActivity.create({ data: { id: s(p.id), userId: s(p.userId), title: s(p.title), date: d(p.date), report: sn(p.report), createdAt: d(p.createdAt) } });
      for (const e of (p.evaluations as Record<string, unknown>[] | undefined) ?? []) {
        await db.peerEvaluation.create({ data: { id: s(e.id), activityId: s(e.activityId), evaluatorId: s(e.evaluatorId), c1: n(e.c1), c2: n(e.c2), c3: n(e.c3), c4: n(e.c4), c5: n(e.c5), comment: sn(e.comment), createdAt: d(e.createdAt) } });
      }
    },
  },

  QUIZ_ATTEMPT: {
    label: "محاولة اختبار",
    by: "PARTICIPANT",
    undoNote: "تُحذف المحاولة ودرجتها فيستطيع المشارك أداء الاختبار من جديد",
    list: async (who, take) =>
      (await db.quizAttempt.findMany({ where: { user: who }, include: { ...withUser, quiz: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take }))
        .map((r) => item("QUIZ_ATTEMPT", r, r.createdAt, `أدّى «${r.quiz.title}»`, `${r.score} من ${r.total}`, "/admin/quizzes")),
    undo: async (id) => {
      const r = await db.quizAttempt.findUnique({ where: { id }, include: { ...withUser, quiz: { select: { title: true } } } });
      if (!r) return null;
      await db.quizAttempt.delete({ where: { id } });
      return { label: `محاولة «${r.quiz.title}»`, detail: `${r.score} من ${r.total}`, at: r.createdAt, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.quizAttempt.create({ data: { id: s(p.id), quizId: s(p.quizId), userId: s(p.userId), score: n(p.score), total: n(p.total), answers: s(p.answers), createdAt: d(p.createdAt) } });
    },
  },

  DIAGNOSTIC: {
    label: "التقييم التشخيصي",
    by: "PARTICIPANT",
    undoNote: "يُحذف التقييم فيستطيع المشارك تعبئته من جديد",
    list: async (who, take) =>
      (await db.diagnostic.findMany({ where: { user: who }, include: withUser, orderBy: { createdAt: "desc" }, take }))
        .map((r) => item("DIAGNOSTIC", r, r.createdAt, r.stage === "PRE" ? "التقييم القبلي" : "التقييم البعدي", r.notes ? cut(r.notes) : undefined, "/admin/diagnostic")),
    undo: async (id) => {
      const r = await db.diagnostic.findUnique({ where: { id }, include: withUser });
      if (!r) return null;
      await db.diagnostic.delete({ where: { id } });
      return { label: r.stage === "PRE" ? "التقييم التشخيصي القبلي" : "التقييم التشخيصي البعدي", detail: r.notes ? cut(r.notes) : undefined, at: r.createdAt, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.diagnostic.create({ data: { id: s(p.id), userId: s(p.userId), stage: s(p.stage), scores: s(p.scores), notes: sn(p.notes), createdAt: d(p.createdAt) } });
    },
  },

  EXCUSE: {
    label: "طلب استئذان",
    by: "PARTICIPANT",
    undoNote: "يُحذف الطلب وقراره إن صدر",
    list: async (who, take) =>
      (await db.excuseRequest.findMany({ where: { user: who }, include: withUser, orderBy: { createdAt: "desc" }, take }))
        .map((r) => item("EXCUSE", r, r.createdAt, `طلب: ${EXCUSE_KINDS[r.kind as keyof typeof EXCUSE_KINDS] ?? r.kind}`, cut(r.reason), "/admin/excuses")),
    undo: async (id) => {
      const r = await db.excuseRequest.findUnique({ where: { id }, include: withUser });
      if (!r) return null;
      await db.excuseRequest.delete({ where: { id } });
      return { label: `طلب استئذان — ${EXCUSE_KINDS[r.kind as keyof typeof EXCUSE_KINDS] ?? r.kind}`, detail: cut(r.reason), at: r.createdAt, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.excuseRequest.create({ data: { id: s(p.id), userId: s(p.userId), kind: s(p.kind), week: nn(p.week), assignmentId: sn(p.assignmentId), reason: s(p.reason), untilAt: dn(p.untilAt), status: s(p.status), decision: sn(p.decision), decidedBy: sn(p.decidedBy), decidedAt: dn(p.decidedAt), createdAt: d(p.createdAt) } });
    },
  },

  // ——— ما يُدخله مدير المشروع على المشاركين ———
  ATTENDANCE: {
    label: "رصد حضور",
    by: "ADMIN",
    undoNote: "يُمحى الرصد فيعود الأسبوع بلا حضور مسجَّل",
    list: async (who, take) => {
      const rows = await db.attendance.findMany({ where: { user: who }, include: withUser, orderBy: [{ week: "desc" }, { id: "desc" }], take });
      return Promise.all(rows.map(async (r) =>
        item("ATTENDANCE", r, await meetingDay(r.week, r.type), `الأسبوع ${r.week} — ${r.type === "INPERSON" ? "اللقاء الحضوري" : "حلقة النقاش"}: ${ATTENDANCE_LABELS[r.status] ?? r.status}`, r.note ?? undefined, `/admin/attendance?week=${r.week}`)));
    },
    undo: async (id) => {
      const r = await db.attendance.findUnique({ where: { id }, include: withUser });
      if (!r) return null;
      await db.attendance.delete({ where: { id } });
      return { label: `رصد حضور الأسبوع ${r.week} — ${ATTENDANCE_LABELS[r.status] ?? r.status}`, detail: r.note ?? undefined, at: await meetingDay(r.week, r.type), userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.attendance.create({ data: { id: s(p.id), userId: s(p.userId), week: n(p.week), type: s(p.type), status: s(p.status), note: sn(p.note), participation: nn(p.participation), circleScore: nn(p.circleScore) } });
    },
  },

  GRADING: {
    label: "تقييم مهمة",
    by: "ADMIN",
    undoNote: "تُمحى الدرجة والتغذية الراجعة، ويبقى تسليم المشارك كما هو بانتظار تقييم جديد",
    list: async (who, take) =>
      (await db.submission.findMany({ where: { user: who, gradedAt: { not: null } }, include: { ...withUser, assignment: { select: { title: true } } }, orderBy: { gradedAt: "desc" }, take }))
        .map((r) => item("GRADING", r, r.gradedAt!, `قيّم «${r.assignment.title}»`, `${(r.completeness ?? 0) + (r.referencing ?? 0) + (r.application ?? 0) + (r.punctuality ?? 0)} من 10${r.feedback ? ` · ${cut(r.feedback, 60)}` : ""}`, `/admin/tasks/${r.assignmentId}`)),
    undo: async (id) => {
      const r = await db.submission.findUnique({ where: { id }, include: { ...withUser, assignment: { select: { title: true } } } });
      if (!r?.gradedAt) return null;
      await db.submission.update({ where: { id }, data: { completeness: null, referencing: null, application: null, punctuality: null, feedback: null, gradedAt: null } });
      return {
        label: `تقييم «${r.assignment.title}»`, detail: r.feedback ? cut(r.feedback) : undefined, at: r.gradedAt, userId: r.userId, userName: r.user.name,
        payload: { id: r.id, completeness: r.completeness, referencing: r.referencing, application: r.application, punctuality: r.punctuality, feedback: r.feedback, gradedAt: r.gradedAt },
      };
    },
    restore: async (p) => {
      await db.submission.update({ where: { id: s(p.id) }, data: { completeness: nn(p.completeness), referencing: nn(p.referencing), application: nn(p.application), punctuality: nn(p.punctuality), feedback: sn(p.feedback), gradedAt: dn(p.gradedAt) } });
    },
  },

  FIELD_APPROVAL: {
    label: "اعتماد معايشة",
    by: "ADMIN",
    undoNote: "يعود السجل بانتظار الاعتماد، ولا تُحتسب ساعاته حتى يُعتمد",
    list: async (who, take) =>
      (await db.fieldLog.findMany({ where: { user: who, approvedAt: { not: null } }, include: withUser, orderBy: { approvedAt: "desc" }, take }))
        .map((r) => item("FIELD_APPROVAL", r, r.approvedAt!, `اعتمد ${r.hours} ساعة مع ${r.mentorName}`, r.approvedBy ?? undefined, "/admin/field")),
    undo: async (id) => {
      const r = await db.fieldLog.findUnique({ where: { id }, include: withUser });
      if (!r?.approvedAt) return null;
      await db.fieldLog.update({ where: { id }, data: { approvedAt: null, approvedBy: null } });
      return { label: `اعتماد معايشة ${r.hours} ساعة`, detail: r.approvedBy ?? undefined, at: r.approvedAt, userId: r.userId, userName: r.user.name, payload: { id: r.id, approvedAt: r.approvedAt, approvedBy: r.approvedBy } };
    },
    restore: async (p) => {
      await db.fieldLog.update({ where: { id: s(p.id) }, data: { approvedAt: dn(p.approvedAt), approvedBy: sn(p.approvedBy) } });
    },
  },

  REPORT_REVIEW: {
    label: "مراجعة تقرير",
    by: "ADMIN",
    undoNote: "تُمحى التغذية الراجعة ويعود التقرير بانتظار المراجعة، ويبقى نصّ المشارك كما هو",
    list: async (who, take) =>
      (await db.weeklyReport.findMany({ where: { user: who, reviewedAt: { not: null } }, include: withUser, orderBy: { reviewedAt: "desc" }, take }))
        .map((r) => item("REPORT_REVIEW", r, r.reviewedAt!, `راجع تقرير الأسبوع ${r.week}`, r.feedback ? cut(r.feedback) : undefined, "/admin/reports")),
    undo: async (id) => {
      const r = await db.weeklyReport.findUnique({ where: { id }, include: withUser });
      if (!r?.reviewedAt) return null;
      await db.weeklyReport.update({ where: { id }, data: { feedback: null, reviewedAt: null } });
      return { label: `مراجعة تقرير الأسبوع ${r.week}`, detail: r.feedback ? cut(r.feedback) : undefined, at: r.reviewedAt, userId: r.userId, userName: r.user.name, payload: { id: r.id, feedback: r.feedback, reviewedAt: r.reviewedAt } };
    },
    restore: async (p) => {
      await db.weeklyReport.update({ where: { id: s(p.id) }, data: { feedback: sn(p.feedback), reviewedAt: dn(p.reviewedAt) } });
    },
  },

  EXCUSE_DECISION: {
    label: "قرار استئذان",
    by: "ADMIN",
    undoNote: "يعود الطلب معلّقاً بانتظار القرار، ويبقى نصّ المشارك كما هو",
    list: async (who, take) =>
      (await db.excuseRequest.findMany({ where: { user: who, decidedAt: { not: null } }, include: withUser, orderBy: { decidedAt: "desc" }, take }))
        .map((r) => item("EXCUSE_DECISION", r, r.decidedAt!, r.status === "APPROVED" ? "قَبِل طلب استئذان" : "لم يقبل طلب استئذان", r.decision ? cut(r.decision) : undefined, "/admin/excuses")),
    undo: async (id) => {
      const r = await db.excuseRequest.findUnique({ where: { id }, include: withUser });
      if (!r?.decidedAt) return null;
      await db.excuseRequest.update({ where: { id }, data: { status: "PENDING", decision: null, decidedBy: null, decidedAt: null } });
      return { label: r.status === "APPROVED" ? "قبول طلب استئذان" : "رفض طلب استئذان", detail: r.decision ? cut(r.decision) : undefined, at: r.decidedAt, userId: r.userId, userName: r.user.name, payload: { id: r.id, status: r.status, decision: r.decision, decidedBy: r.decidedBy, decidedAt: r.decidedAt } };
    },
    restore: async (p) => {
      await db.excuseRequest.update({ where: { id: s(p.id) }, data: { status: s(p.status), decision: sn(p.decision), decidedBy: sn(p.decidedBy), decidedAt: dn(p.decidedAt) } });
    },
  },

  FINAL_GRADE: {
    label: "اعتماد الدرجة النهائية",
    by: "ADMIN",
    undoNote: "يُلغى اعتماد الدرجة فيعود احتسابها آلياً كما قبل الاعتماد",
    list: async (who, take) =>
      (await db.finalGrade.findMany({ where: { user: who }, include: withUser, orderBy: { approvedAt: "desc" }, take }))
        .map((r) => item("FINAL_GRADE", r, r.approvedAt, `اعتمد الدرجة ${r.computed + r.adjustment} من 100`, r.reason ?? undefined, "/admin/grades")),
    undo: async (id) => {
      const r = await db.finalGrade.findUnique({ where: { id }, include: withUser });
      if (!r) return null;
      await db.finalGrade.delete({ where: { id } });
      return { label: `اعتماد الدرجة ${r.computed + r.adjustment} من 100`, detail: r.reason ?? undefined, at: r.approvedAt, userId: r.userId, userName: r.user.name, payload: r };
    },
    restore: async (p) => {
      await db.finalGrade.create({ data: { id: s(p.id), userId: s(p.userId), computed: n(p.computed), adjustment: n(p.adjustment), reason: sn(p.reason), breakdown: s(p.breakdown), approvedBy: s(p.approvedBy), approvedAt: d(p.approvedAt) } });
    },
  },
};

export type ActivityKind = keyof typeof ACTIVITY_KINDS;

export function isActivityKind(v: string): v is ActivityKind {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_KINDS, v);
}

/**
 * أحدث ما أُدخل في المنصة. يُؤخذ من كل نوعٍ طرفُه الأحدث ثم يُدمج ويُرتَّب، فلا
 * يُقرأ الجدول كاملاً ولا يطول الطلب بطول البرنامج.
 */
export async function buildActivity(opts: { kind?: ActivityKind; by?: ActivityBy; userId?: string; limit?: number } = {}): Promise<ActivityItem[]> {
  const limit = opts.limit ?? 60;
  const who = opts.userId ? { id: opts.userId, ...(await participantsWhere()) } : await participantsWhere();
  const kinds = (Object.keys(ACTIVITY_KINDS) as ActivityKind[]).filter(
    (k) => (!opts.kind || k === opts.kind) && (!opts.by || ACTIVITY_KINDS[k].by === opts.by),
  );
  // نصيب النوع الواحد: الحدّ كاملاً حين يُطلب نوعٌ بعينه، وطرفٌ منه حين تُدمج الأنواع
  const take = opts.kind ? limit : Math.max(8, Math.ceil(limit / 3));
  const lists = await Promise.all(kinds.map((k) => ACTIVITY_KINDS[k].list(who, take).catch(() => [] as ActivityItem[])));
  return lists.flat().sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
