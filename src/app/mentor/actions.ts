"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { notifyUsers } from "@/lib/notify";
import { num, str } from "@/lib/utils";

function ok(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}
function fail(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);
}

/**
 * المشرف المرافق يقيّم ولا يدير: صلاحيته محصورة في من رُبطوا به،
 * فيُتحقق من الرابط في كل إجراء لا في الواجهة وحدها.
 */
async function mentorOf(userId: string, path: string) {
  const me = await requireRole("MENTOR");
  const mentee = await db.user.findFirst({ where: { id: userId, mentorId: me.id, active: true }, select: { id: true, name: true } });
  if (!mentee) fail(path, "هذا المشارك ليس في مجموعتك");
  return { me, mentee };
}

/** تغذية راجعة على تقرير أسبوعي لمشارك في مجموعة المشرف */
export async function mentorReviewReport(formData: FormData) {
  const id = str(formData.get("id"));
  const report = await db.weeklyReport.findUnique({ where: { id }, select: { id: true, userId: true, week: true } });
  if (!report) fail("/mentor/reports", "التقرير غير موجود");
  const path = `/mentor/reports?week=${report.week}`;
  await mentorOf(report.userId, path);
  const feedback = str(formData.get("feedback"));
  if (!feedback) fail(path, "اكتب تغذية راجعة قبل الحفظ");
  await db.weeklyReport.update({ where: { id }, data: { feedback, reviewedAt: new Date() } });
  await notifyUsers([report.userId], {
    title: `تغذية راجعة على تقرير الأسبوع ${report.week}`,
    body: feedback.slice(0, 120),
    url: `/app/reports/${report.week}`,
  });
  revalidatePath("/mentor/reports");
  ok(path, "حُفظت التغذية الراجعة وأُشعر المشارك");
}

/** تقييم مهمة بسلّم التقدير لمشارك في مجموعة المشرف */
export async function mentorGradeSubmission(formData: FormData) {
  const id = str(formData.get("id"));
  const s = await db.submission.findUnique({ where: { id }, include: { assignment: { select: { id: true, title: true } } } });
  if (!s) fail("/mentor/tasks", "التسليم غير موجود");
  const path = `/mentor/tasks?a=${s.assignmentId}`;
  await mentorOf(s.userId, path);
  const vals = ["completeness", "referencing", "application", "punctuality"].map((k) => num(formData.get(k)));
  if (vals.some((v) => v < 1 || v > 4)) fail(path, "قيّم كل معيار من 1 إلى 4");
  const feedback = str(formData.get("feedback"));
  await db.submission.update({
    where: { id },
    data: { completeness: vals[0], referencing: vals[1], application: vals[2], punctuality: vals[3], feedback: feedback || null, gradedAt: new Date() },
  });
  await notifyUsers([s.userId], {
    title: `تم تقييم: ${s.assignment.title}`,
    body: `الدرجة ${vals.reduce((a, b) => a + b, 0)} من 16${feedback ? ` — ${feedback.slice(0, 80)}` : ""}`,
    url: `/app/tasks/${s.assignmentId}`,
  });
  revalidatePath("/mentor/tasks");
  ok(path, "حُفظ التقييم وأُشعر المشارك");
}
