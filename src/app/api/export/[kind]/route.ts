import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeGrades } from "@/lib/grades";
import { CONTINUOUS_ASSESSMENT } from "@/lib/program";
import { ATTENDANCE_LABELS } from "@/lib/utils";
import { cohortWhere } from "@/lib/cohort";

/** تصدير بيانات المنصة إلى ملفات CSV تفتحها برامج الجداول مباشرة */
const KINDS = ["grades", "attendance", "tasks", "field", "reading", "reports"] as const;
type Kind = (typeof KINDS)[number];

function csv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM ليقرأ برنامج الجداول العربية بترميز صحيح
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") return new Response("غير مصرح", { status: 403 });
  const { kind } = await params;
  if (!KINDS.includes(kind as Kind)) return new Response("نوع غير معروف", { status: 404 });

  const participants = await db.user.findMany({ where: { role: "PARTICIPANT", ...(await cohortWhere()) }, orderBy: { name: "asc" }, select: { id: true, name: true, username: true, active: true } });
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));
  let rows: (string | number)[][] = [];

  if (kind === "grades") {
    const grades = await Promise.all(participants.map((p) => computeGrades(p.id)));
    const finals = await db.finalGrade.findMany({ where: { userId: { in: participants.map((p) => p.id) } } });
    rows = [["المشارك", "اسم المستخدم", ...CONTINUOUS_ASSESSMENT.map((c) => `${c.component} (${c.points})`), "التقييم المستمر (70)", "مشروع التخرج (30)", "المحتسَب", "التعديل", "مسوّغ التعديل", "النهائي المعتمد", "المستوى", "الحالة"]];
    participants.forEach((p, i) => {
      const g = grades[i];
      const parts: Record<string, number> = { attendance: g.attendance, reading: g.reading, quizzes: g.quizzes, tasks: g.tasks, field: g.field, leadership: g.leadership };
      const f = finals.find((x) => x.userId === p.id);
      const finalTotal = f ? Math.max(0, Math.min(100, Math.round((f.computed + f.adjustment) * 10) / 10)) : "";
      rows.push([p.name, p.username, ...CONTINUOUS_ASSESSMENT.map((c) => parts[c.key]), g.continuous, g.project, g.total, f?.adjustment ?? "", f?.reason ?? "", finalTotal, g.level, p.active ? "نشط" : "موقوف"]);
    });
  } else if (kind === "attendance") {
    const att = await db.attendance.findMany({ orderBy: [{ week: "asc" }] });
    rows = [["المشارك", "الأسبوع", "النوع", "الحالة", "ملاحظة"]];
    for (const a of att) rows.push([nameOf.get(a.userId) ?? a.userId, a.week, a.type === "INPERSON" ? "حضوري" : "عن بُعد", ATTENDANCE_LABELS[a.status] ?? a.status, a.note ?? ""]);
  } else if (kind === "tasks") {
    const subs = await db.submission.findMany({ include: { assignment: true }, orderBy: { submittedAt: "asc" } });
    rows = [["المشارك", "المهمة", "الأسبوع", "تاريخ التسليم", "الاكتمال", "الربط بالمرجع", "التطبيق", "الالتزام بالموعد", "المجموع من 16", "التغذية الراجعة"]];
    for (const s of subs) rows.push([nameOf.get(s.userId) ?? s.userId, s.assignment.title, s.assignment.week, s.submittedAt.toISOString().slice(0, 10), s.completeness ?? "", s.referencing ?? "", s.application ?? "", s.punctuality ?? "", s.gradedAt ? (s.completeness ?? 0) + (s.referencing ?? 0) + (s.application ?? 0) + (s.punctuality ?? 0) : "", s.feedback ?? ""]);
  } else if (kind === "field") {
    const logs = await db.fieldLog.findMany({ orderBy: { date: "asc" } });
    rows = [["المشارك", "التاريخ", "الساعات", "المشرف المرافق", "الملاحظة", "الاعتماد"]];
    for (const l of logs) rows.push([nameOf.get(l.userId) ?? l.userId, l.date.toISOString().slice(0, 10), l.hours, l.mentorName, l.note, l.approvedAt ? "معتمد" : "معلّق"]);
  } else if (kind === "reading") {
    const cards = await db.readingCard.findMany({ orderBy: { date: "asc" } });
    rows = [["المشارك", "التاريخ", "الكتاب", "من صفحة", "إلى صفحة", "أهم فائدة", "سؤال للحلقة"]];
    for (const c of cards) rows.push([nameOf.get(c.userId) ?? c.userId, c.date.toISOString().slice(0, 10), c.book, c.fromPage, c.toPage, c.benefit, c.question ?? ""]);
  } else {
    const reps = await db.weeklyReport.findMany({ orderBy: [{ week: "asc" }] });
    rows = [["المشارك", "الأسبوع", "تاريخ التسليم", "الورد المنجز", "الفوائد", "المهمة", "المعايشة", "نتيجة الاختبار", "تطبيق ميداني", "صعوبة", "التغذية الراجعة"]];
    for (const r of reps) rows.push([nameOf.get(r.userId) ?? r.userId, r.week, r.submittedAt.toISOString().slice(0, 10), r.reading, r.benefits, r.taskProgress, r.fieldNote ?? "", r.quizResult ?? "", r.application ?? "", r.difficulty ?? "", r.feedback ?? ""]);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="maalem-${kind}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
