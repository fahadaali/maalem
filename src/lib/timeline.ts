import { db } from "./db";
import { ATTENDANCE_LABELS } from "./utils";
import { EXCUSE_KINDS } from "./excuses";
import { keyToDate } from "./dates";
import { emptyParticipant, loadParticipant, loadProgram } from "./participant-data";

export type Entry = { at: Date; kind: string; title: string; detail?: string; href?: string };

/**
 * سجل نشاط المشارك مرتباً بالزمن: من التوقيع على الميثاق إلى وثيقة الإتمام،
 * مجموعاً من سجلات المنصة نفسها لا من جدول منفصل، فلا يتخلّف عن الواقع.
 */
/**
 * لمن يُرسم السجل: روابطه إلى صفحات المشارك نفسه، أو إلى تبويبات ملفه عند المدير،
 * أو بلا روابط للمشرف المرافق — كانت روابط `/app` تُعاد عنهما إلى لوحتيهما.
 */
export type TimelineAudience = "participant" | "admin" | "mentor";

/** تبويب ملف المشارك عند المدير لكل نوع من أنواع السجل */
const ADMIN_TAB: Record<string, string> = {
  القراءة: "reading",
  "التقرير الأسبوعي": "work",
  المهام: "work",
  الاختبارات: "quizzes",
  الحضور: "quizzes",
  الاستئذان: "quizzes",
  "التقييم التشخيصي": "quizzes",
  المعايشة: "field",
  "الدور القيادي": "field",
  "مشروع التخرج": "field",
  "تقييم المشرف": "field",
  التأمل: "journal",
};

/** عناوين ما لم يُعثر عليه في مهام الدفعة النشطة واختباراتها (مشاركٌ من دفعة سابقة) */
async function titlesOf(table: "assignment" | "quiz", ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows =
    table === "assignment"
      ? await db.assignment.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })
      : await db.quiz.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
  return new Map(rows.map((r) => [r.id, r.title]));
}

export async function buildTimeline(userId: string, limit = 200, audience: TimelineAudience = "participant"): Promise<Entry[]> {
  // صفوف المشارك والدفعة من المُحمِّل المشترك — جُلبت مرة في الطلب للدرجة و«مهامي»،
  // فلا يعيد السجل جلبها؛ ويُجلب هنا ما لا يقرؤه غيره فقط
  const [loaded, program, reflections, diagnostics, excuses, certificate, mentorEvals] = await Promise.all([
    loadParticipant(userId),
    loadProgram(),
    db.reflection.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 40, select: { date: true, text: true } }),
    db.diagnostic.findMany({ where: { userId }, select: { stage: true, createdAt: true } }),
    db.excuseRequest.findMany({ where: { userId }, select: { kind: true, reason: true, createdAt: true, decidedAt: true, status: true, decision: true } }),
    db.certificate.findUnique({ where: { userId }, select: { kind: true, level: true, serial: true, issuedAt: true } }),
    db.mentorEvaluation.findMany({ where: { userId }, select: { createdAt: true, notes: true, mentor: { select: { name: true } } } }),
  ]);
  const rows = loaded ?? emptyParticipant(userId);
  const user = loaded?.user;

  const assignmentTitle = new Map(program.assignments.map((a) => [a.id, a.title]));
  const quizTitle = new Map(program.quizzes.map((q) => [q.id, q.title]));
  const [moreAssignments, moreQuizzes] = await Promise.all([
    titlesOf("assignment", [...new Set(rows.submissions.map((s) => s.assignmentId).filter((id) => !assignmentTitle.has(id)))]),
    titlesOf("quiz", [...new Set(rows.attempts.map((a) => a.quizId).filter((id) => !quizTitle.has(id)))]),
  ]);
  const titleOfAssignment = (id: string) => assignmentTitle.get(id) ?? moreAssignments.get(id) ?? "مهمة محذوفة";
  const titleOfQuiz = (id: string) => quizTitle.get(id) ?? moreQuizzes.get(id) ?? "اختبار محذوف";

  // الحضور يُؤرَّخ بيوم اللقاء من جدول الدفعة: السبت للحضوري، والثلاثاء للحلقة
  const weekStart = new Map(program.weeks.map((w) => [w.number, keyToDate(w.gregorian)]));
  const e: Entry[] = [];
  if (user) {
    e.push({ at: user.createdAt, kind: "الحساب", title: "أُضيف إلى الدفعة" });
    if (user.charterAcceptedAt) e.push({ at: user.charterAcceptedAt, kind: "الميثاق", title: "وقّع ميثاق المشاركة", detail: user.charterName ?? undefined, href: "/app/charter" });
    if (user.surveyDoneAt) e.push({ at: user.surveyDoneAt, kind: "الاستبانة", title: "عبّأ استبانة الرضا" });
    if (user.portfolioSubmittedAt) e.push({ at: user.portfolioSubmittedAt, kind: "ملف الإنجاز", title: "سلّم ملف الإنجاز" });
  }
  for (const a of rows.attendance) {
    const start = weekStart.get(a.week);
    if (!start) continue;
    e.push({ at: new Date(start.getTime() + (a.type === "INPERSON" ? 0 : 3) * 86400000), kind: "الحضور", title: `الأسبوع ${a.week} — ${a.type === "INPERSON" ? "اللقاء الحضوري" : "حلقة النقاش"}: ${ATTENDANCE_LABELS[a.status] ?? a.status}`, detail: a.note ?? undefined });
  }
  for (const c of rows.cards) e.push({ at: c.createdAt, kind: "القراءة", title: `بطاقة قراءة — ${c.book}`, detail: `الصفحات ${c.fromPage}–${c.toPage} (${c.toPage - c.fromPage + 1} صفحة)`, href: "/app/reading" });
  for (const r of rows.reports) e.push({ at: r.submittedAt, kind: "التقرير الأسبوعي", title: `سلّم تقرير الأسبوع ${r.week}`, detail: r.reviewedAt ? "روجِع" : "بانتظار المراجعة" });
  for (const a of rows.attempts) e.push({ at: a.createdAt, kind: "الاختبارات", title: `أدى ${titleOfQuiz(a.quizId)}`, detail: `${a.score} من ${a.total}`, href: `/app/quizzes/${a.quizId}` });
  for (const s of rows.submissions) {
    const title = titleOfAssignment(s.assignmentId);
    e.push({ at: s.submittedAt, kind: "المهام", title: `سلّم ${title}`, href: `/app/tasks/${s.assignmentId}` });
    if (s.gradedAt) e.push({ at: s.gradedAt, kind: "المهام", title: `قُيّمت ${title}`, detail: s.feedback ?? undefined });
  }
  for (const f of rows.fieldLogs) {
    e.push({ at: f.createdAt, kind: "المعايشة", title: `سجّل ${f.hours} ساعة مع ${f.mentorName}`, detail: f.note });
    if (f.approvedAt) e.push({ at: f.approvedAt, kind: "المعايشة", title: `اعتُمدت ${f.hours} ساعة`, detail: f.approvedBy ?? undefined });
  }
  for (const a of rows.activities) e.push({ at: a.createdAt, kind: "الدور القيادي", title: a.title, detail: a.report ?? undefined });
  for (const r of reflections) e.push({ at: r.date, kind: "التأمل", title: r.text.slice(0, 90) });
  for (const d of diagnostics) e.push({ at: d.createdAt, kind: "التقييم التشخيصي", title: d.stage === "PRE" ? "التقييم القبلي" : "التقييم البعدي" });
  for (const x of excuses) {
    e.push({ at: x.createdAt, kind: "الاستئذان", title: `طلب: ${EXCUSE_KINDS[x.kind as keyof typeof EXCUSE_KINDS] ?? x.kind}`, detail: x.reason });
    if (x.decidedAt) e.push({ at: x.decidedAt, kind: "الاستئذان", title: x.status === "APPROVED" ? "قُبل طلبه" : "لم يُقبل طلبه", detail: x.decision ?? undefined });
  }
  for (const m of mentorEvals) e.push({ at: m.createdAt, kind: "تقييم المشرف", title: `قيّمه ${m.mentor.name}`, detail: m.notes ?? undefined });
  if (rows.project?.createdAt) e.push({ at: rows.project.createdAt, kind: "مشروع التخرج", title: `سجّل موضوع مشروعه: ${rows.project.topic}` });
  if (certificate) e.push({ at: certificate.issuedAt, kind: "الوثيقة", title: certificate.kind === "ATTENDANCE" ? "صدرت إفادة حضوره" : "صدرت وثيقة إتمامه", detail: `${certificate.level} · ${certificate.serial}` });

  const relink = (x: Entry): Entry => {
    if (audience === "participant") return x;
    if (audience === "mentor") return { ...x, href: undefined };
    const tab = ADMIN_TAB[x.kind];
    return { ...x, href: tab ? `/admin/participants/${userId}?tab=${tab}` : undefined };
  };
  return e
    .filter((x) => x.at.getTime() > 0)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit)
    .map(relink);
}
