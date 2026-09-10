import { db } from "./db";
import { ATTENDANCE_LABELS } from "./utils";
import { EXCUSE_KINDS } from "./excuses";

export type Entry = { at: Date; kind: string; title: string; detail?: string; href?: string };

/**
 * سجل نشاط المشارك مرتباً بالزمن: من التوقيع على الميثاق إلى وثيقة الإتمام،
 * مجموعاً من سجلات المنصة نفسها لا من جدول منفصل، فلا يتخلّف عن الواقع.
 */
export async function buildTimeline(userId: string, limit = 200): Promise<Entry[]> {
  const [user, attendance, cards, reports, attempts, submissions, fieldLogs, activities, reflections, diagnostics, excuses, certificate, project, mentorEvals] =
    await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { createdAt: true, charterAcceptedAt: true, charterName: true, surveyDoneAt: true, portfolioSubmittedAt: true } }),
      db.attendance.findMany({ where: { userId } }),
      db.readingCard.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 80 }),
      db.weeklyReport.findMany({ where: { userId } }),
      db.quizAttempt.findMany({ where: { userId }, include: { quiz: { select: { id: true, title: true } } } }),
      db.submission.findMany({ where: { userId }, include: { assignment: { select: { id: true, title: true } } } }),
      db.fieldLog.findMany({ where: { userId } }),
      db.leadershipActivity.findMany({ where: { userId } }),
      db.reflection.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 40 }),
      db.diagnostic.findMany({ where: { userId } }),
      db.excuseRequest.findMany({ where: { userId } }),
      db.certificate.findUnique({ where: { userId } }),
      db.graduationProject.findUnique({ where: { userId } }),
      db.mentorEvaluation.findMany({ where: { userId }, include: { mentor: { select: { name: true } } } }),
    ]);

  const e: Entry[] = [];
  if (user) {
    e.push({ at: user.createdAt, kind: "الحساب", title: "أُضيف إلى الدفعة" });
    if (user.charterAcceptedAt) e.push({ at: user.charterAcceptedAt, kind: "الميثاق", title: "وقّع ميثاق المشاركة", detail: user.charterName ?? undefined, href: "/app/charter" });
    if (user.surveyDoneAt) e.push({ at: user.surveyDoneAt, kind: "الاستبانة", title: "عبّأ استبانة الرضا" });
    if (user.portfolioSubmittedAt) e.push({ at: user.portfolioSubmittedAt, kind: "ملف الإنجاز", title: "سلّم ملف الإنجاز" });
  }
  for (const a of attendance) {
    e.push({ at: new Date(0), kind: "الحضور", title: `الأسبوع ${a.week} — ${a.type === "INPERSON" ? "اللقاء الحضوري" : "حلقة النقاش"}: ${ATTENDANCE_LABELS[a.status] ?? a.status}`, detail: a.note ?? undefined });
  }
  for (const c of cards) e.push({ at: c.createdAt, kind: "القراءة", title: `بطاقة قراءة — ${c.book}`, detail: `الصفحات ${c.fromPage}–${c.toPage}`, href: "/app/reading" });
  for (const r of reports) e.push({ at: r.submittedAt, kind: "التقرير الأسبوعي", title: `سلّم تقرير الأسبوع ${r.week}`, detail: r.reviewedAt ? "روجِع" : "بانتظار المراجعة" });
  for (const a of attempts) e.push({ at: a.createdAt, kind: "الاختبارات", title: `أدى ${a.quiz.title}`, detail: `${a.score} من ${a.total}`, href: `/app/quizzes/${a.quiz.id}` });
  for (const s of submissions) {
    e.push({ at: s.submittedAt, kind: "المهام", title: `سلّم ${s.assignment.title}`, href: `/app/tasks/${s.assignment.id}` });
    if (s.gradedAt) e.push({ at: s.gradedAt, kind: "المهام", title: `قُيّمت ${s.assignment.title}`, detail: s.feedback ?? undefined });
  }
  for (const f of fieldLogs) {
    e.push({ at: f.createdAt, kind: "المعايشة", title: `سجّل ${f.hours} ساعة مع ${f.mentorName}`, detail: f.note });
    if (f.approvedAt) e.push({ at: f.approvedAt, kind: "المعايشة", title: `اعتُمدت ${f.hours} ساعة`, detail: f.approvedBy ?? undefined });
  }
  for (const a of activities) e.push({ at: a.createdAt, kind: "الدور القيادي", title: a.title, detail: a.report ?? undefined });
  for (const r of reflections) e.push({ at: r.date, kind: "التأمل", title: r.text.slice(0, 90) });
  for (const d of diagnostics) e.push({ at: d.createdAt, kind: "التقييم التشخيصي", title: d.stage === "PRE" ? "التقييم القبلي" : "التقييم البعدي" });
  for (const x of excuses) {
    e.push({ at: x.createdAt, kind: "الاستئذان", title: `طلب: ${EXCUSE_KINDS[x.kind as keyof typeof EXCUSE_KINDS] ?? x.kind}`, detail: x.reason });
    if (x.decidedAt) e.push({ at: x.decidedAt, kind: "الاستئذان", title: x.status === "APPROVED" ? "قُبل طلبه" : "لم يُقبل طلبه", detail: x.decision ?? undefined });
  }
  for (const m of mentorEvals) e.push({ at: m.createdAt, kind: "تقييم المشرف", title: `قيّمه ${m.mentor.name}`, detail: m.notes ?? undefined });
  if (project?.createdAt) e.push({ at: project.createdAt, kind: "مشروع التخرج", title: `سجّل موضوع مشروعه: ${project.topic}` });
  if (certificate) e.push({ at: certificate.issuedAt, kind: "الوثيقة", title: certificate.kind === "ATTENDANCE" ? "صدرت إفادة حضوره" : "صدرت وثيقة إتمامه", detail: `${certificate.level} · ${certificate.serial}` });

  return e
    .filter((x) => x.at.getTime() > 0)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}
