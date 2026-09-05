"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { notifyUsers, notifyRole } from "@/lib/notify";
import { num, str } from "@/lib/utils";
import { keyToDate } from "@/lib/dates";
import { cookies } from "next/headers";
import { PREVIEW_COOKIE } from "@/lib/roles";
import { PHASES } from "@/lib/program";

function ok(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}
function fail(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);
}
const admin = () => requireRole("ADMIN");

// ——— المستخدمون ———
export async function createUser(formData: FormData) {
  await admin();
  const name = str(formData.get("name"));
  const username = str(formData.get("username")).toLowerCase();
  const password = str(formData.get("password"));
  const phone = str(formData.get("phone"));
  const role = str(formData.get("role")) || "PARTICIPANT";
  const mentorId = str(formData.get("mentorId")) || null;
  if (!name || !username || password.length < 6) fail("/admin/participants", "الاسم واسم المستخدم وكلمة مرور (6 أحرف فأكثر) حقول إلزامية");
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) fail("/admin/participants", "اسم المستخدم: أحرف إنجليزية صغيرة وأرقام فقط (3–30)");
  if (!["ADMIN", "PARTICIPANT", "MENTOR"].includes(role)) fail("/admin/participants", "دور غير صحيح");
  if (await db.user.findUnique({ where: { username } })) fail("/admin/participants", "اسم المستخدم مستخدم من قبل");
  await db.user.create({ data: { name, username, phone: phone || null, role, mentorId, passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/admin/participants");
  ok("/admin/participants", `تمت إضافة ${name}`);
}

export async function updateUser(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const path = `/admin/participants/${id}`;
  const name = str(formData.get("name"));
  const phone = str(formData.get("phone"));
  const email = str(formData.get("email"));
  const role = str(formData.get("role"));
  const mentorId = str(formData.get("mentorId")) || null;
  const active = formData.get("active") === "on";
  const password = str(formData.get("password"));
  if (!name) fail(path, "الاسم إلزامي");
  if (!["ADMIN", "PARTICIPANT", "MENTOR"].includes(role)) fail(path, "دور غير صحيح");
  if (password && password.length < 6) fail(path, "كلمة المرور الجديدة 6 أحرف فأكثر");
  await db.user.update({
    where: { id },
    data: { name, phone: phone || null, email: email || null, role, mentorId: mentorId === id ? null : mentorId, active, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
  });
  revalidatePath("/admin/participants");
  ok(path, "تم حفظ بيانات المستخدم");
}

export async function addFeedbackSession(formData: FormData) {
  await admin();
  const userId = str(formData.get("userId"));
  const notes = str(formData.get("notes"));
  const dateKey = str(formData.get("date"));
  const path = `/admin/participants/${userId}`;
  if (!notes) fail(path, "اكتب ملاحظات الجلسة");
  await db.feedbackSession.create({ data: { userId, notes, date: dateKey ? keyToDate(dateKey) : new Date() } });
  await notifyUsers([userId], { title: "تغذية راجعة فردية", body: notes.slice(0, 120), url: "/app/portfolio" });
  ok(path, "تم تسجيل جلسة التغذية الراجعة وإشعار المشارك");
}

// ——— الحضور ———
export async function saveAttendance(formData: FormData) {
  await admin();
  const week = num(formData.get("week"), -1);
  if (week < 0 || week > 14) fail("/admin/attendance", "أسبوع غير صحيح");
  const entries: { userId: string; type: string; status: string }[] = [];
  for (const [k, v] of formData.entries()) {
    const m = k.match(/^att_([^_]+)_(INPERSON|REMOTE)$/);
    if (m && typeof v === "string") entries.push({ userId: m[1], type: m[2], status: v });
  }
  await db.$transaction(
    entries.map((e) =>
      e.status === ""
        ? db.attendance.deleteMany({ where: { userId: e.userId, week, type: e.type } })
        : db.attendance.upsert({
            where: { userId_week_type: { userId: e.userId, week, type: e.type } },
            create: { userId: e.userId, week, type: e.type, status: e.status },
            update: { status: e.status },
          }),
    ),
  );
  revalidatePath("/admin/attendance");
  ok(`/admin/attendance?week=${week}`, "تم حفظ الحضور");
}

// ——— التقارير الأسبوعية ———
export async function reviewReport(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const feedback = str(formData.get("feedback"));
  const r = await db.weeklyReport.update({ where: { id }, data: { feedback: feedback || null, reviewedAt: new Date() } });
  if (feedback) await notifyUsers([r.userId], { title: `تغذية راجعة على تقرير الأسبوع ${r.week}`, body: feedback.slice(0, 120), url: `/app/reports/${r.week}` });
  ok(`/admin/reports?week=${r.week}`, "تم حفظ المراجعة");
}

// ——— المهام ———
export async function createAssignment(formData: FormData) {
  await admin();
  const title = str(formData.get("title"));
  const week = num(formData.get("week"), -1);
  const description = str(formData.get("description"));
  const competency = str(formData.get("competency"));
  const dueAt = str(formData.get("dueAt"));
  if (!title || week < 0 || !dueAt) fail("/admin/tasks", "العنوان والأسبوع وموعد التسليم حقول إلزامية");
  const a = await db.assignment.create({ data: { title, week, description: description || null, competency: competency || null, dueAt: new Date(dueAt + "+03:00") } });
  await notifyRole("PARTICIPANT", { title: "مهمة جديدة", body: title, url: `/app/tasks/${a.id}` });
  revalidatePath("/admin/tasks");
  ok("/admin/tasks", "تمت إضافة المهمة وإشعار المشاركين");
}

export async function updateAssignment(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const title = str(formData.get("title"));
  const week = num(formData.get("week"), -1);
  const description = str(formData.get("description"));
  const competency = str(formData.get("competency"));
  const dueAt = str(formData.get("dueAt"));
  if (!title || week < 0 || !dueAt) fail(`/admin/tasks/${id}`, "العنوان والأسبوع وموعد التسليم حقول إلزامية");
  await db.assignment.update({ where: { id }, data: { title, week, description: description || null, competency: competency || null, dueAt: new Date(dueAt + "+03:00") } });
  ok(`/admin/tasks/${id}`, "تم تحديث المهمة");
}

export async function deleteAssignment(formData: FormData) {
  await admin();
  await db.assignment.delete({ where: { id: str(formData.get("id")) } });
  revalidatePath("/admin/tasks");
  ok("/admin/tasks", "تم حذف المهمة");
}

export async function gradeSubmission(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const vals = ["completeness", "referencing", "application", "punctuality"].map((k) => num(formData.get(k)));
  const s = await db.submission.findUnique({ where: { id }, include: { assignment: true } });
  if (!s) fail("/admin/tasks", "التسليم غير موجود");
  const path = `/admin/tasks/${s.assignmentId}`;
  if (vals.some((v) => v < 1 || v > 4)) fail(path, "قيّم كل معيار من 1 إلى 4");
  const feedback = str(formData.get("feedback"));
  await db.submission.update({ where: { id }, data: { completeness: vals[0], referencing: vals[1], application: vals[2], punctuality: vals[3], feedback: feedback || null, gradedAt: new Date() } });
  await notifyUsers([s.userId], { title: `تم تقييم: ${s.assignment.title}`, body: `الدرجة ${vals.reduce((a, b) => a + b, 0)} من 16${feedback ? " — " + feedback.slice(0, 80) : ""}`, url: `/app/tasks/${s.assignmentId}` });
  ok(path, "تم حفظ التقييم وإشعار المشارك");
}

// ——— الاختبارات ———
export async function createQuiz(formData: FormData) {
  await admin();
  const title = str(formData.get("title"));
  const kind = str(formData.get("kind")) || "FIQH";
  const week = str(formData.get("week")) === "" ? null : num(formData.get("week"));
  const passMark = num(formData.get("passMark"), 70);
  if (!title) fail("/admin/quizzes", "اكتب عنوان الاختبار");
  const q = await db.quiz.create({ data: { title, kind, week, passMark } });
  redirect(`/admin/quizzes/${q.id}`);
}

export async function addQuestion(formData: FormData) {
  await admin();
  const quizId = str(formData.get("quizId"));
  const text = str(formData.get("text"));
  const options = [0, 1, 2, 3].map((i) => str(formData.get(`opt${i}`))).filter(Boolean);
  const correctIndex = num(formData.get("correctIndex"), -1);
  const path = `/admin/quizzes/${quizId}`;
  if (!text || options.length < 2) fail(path, "نص السؤال وخياران على الأقل");
  if (correctIndex < 0 || correctIndex >= options.length) fail(path, "حدد الإجابة الصحيحة");
  const order = (await db.question.count({ where: { quizId } })) + 1;
  await db.question.create({ data: { quizId, order, text, options: JSON.stringify(options), correctIndex } });
  ok(path, "تمت إضافة السؤال");
}

export async function deleteQuestion(formData: FormData) {
  await admin();
  const q = await db.question.delete({ where: { id: str(formData.get("id")) } });
  revalidatePath(`/admin/quizzes/${q.quizId}`);
}

export async function publishQuiz(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const publish = str(formData.get("publish")) === "1";
  const quiz = await db.quiz.findUnique({ where: { id }, include: { _count: { select: { questions: true } } } });
  if (!quiz) fail("/admin/quizzes", "الاختبار غير موجود");
  if (publish && quiz._count.questions === 0) fail(`/admin/quizzes/${id}`, "أضف سؤالاً واحداً على الأقل قبل النشر");
  await db.quiz.update({ where: { id }, data: { published: publish } });
  if (publish && !quiz.published) await notifyRole("PARTICIPANT", { title: "اختبار تكويني جديد", body: quiz.title, url: `/app/quizzes/${id}` });
  ok(`/admin/quizzes/${id}`, publish ? "تم نشر الاختبار وإشعار المشاركين" : "تم إخفاء الاختبار");
}

export async function deleteQuiz(formData: FormData) {
  await admin();
  await db.quiz.delete({ where: { id: str(formData.get("id")) } });
  revalidatePath("/admin/quizzes");
  ok("/admin/quizzes", "تم حذف الاختبار");
}

// ——— المعايشة ———
export async function approveFieldLog(formData: FormData) {
  const me = await requireRole("ADMIN", "MENTOR");
  const id = str(formData.get("id"));
  const back = str(formData.get("back")) || "/admin/field";
  const log = await db.fieldLog.findUnique({ where: { id }, include: { user: true } });
  if (!log) fail(back, "السجل غير موجود");
  if (me.role === "MENTOR" && log.user.mentorId !== me.id) fail(back, "هذا المشارك ليس من مجموعتك");
  await db.fieldLog.update({ where: { id }, data: { approvedAt: new Date(), approvedBy: me.id } });
  await notifyUsers([log.userId], { title: "اعتماد سجل معايشة", body: `اعتُمدت ${log.hours} ساعة معايشة.`, url: "/app/field" });
  revalidatePath(back);
  redirect(back);
}

export async function rejectFieldLog(formData: FormData) {
  const me = await requireRole("ADMIN", "MENTOR");
  const id = str(formData.get("id"));
  const back = str(formData.get("back")) || "/admin/field";
  const reason = str(formData.get("reason"));
  const log = await db.fieldLog.findUnique({ where: { id }, include: { user: true } });
  if (!log) fail(back, "السجل غير موجود");
  if (me.role === "MENTOR" && log.user.mentorId !== me.id) fail(back, "هذا المشارك ليس من مجموعتك");
  await db.fieldLog.delete({ where: { id } });
  await notifyUsers([log.userId], { title: "لم يُعتمد سجل معايشة", body: reason || `سجل ${log.hours} ساعة لم يُعتمد. راجع المشرف المرافق.`, url: "/app/field" });
  revalidatePath(back);
  redirect(back);
}

// ——— مشاريع التخرج ———
export async function updateProjectAdmin(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const status = str(formData.get("status"));
  const mentorName = str(formData.get("mentorName"));
  const adminNote = str(formData.get("adminNote"));
  const p = await db.graduationProject.findUnique({ where: { id } });
  if (!p) fail("/admin/projects", "المشروع غير موجود");
  if (!["PROPOSED", "APPROVED", "DRAFT", "FINAL", "JUDGED"].includes(status)) fail("/admin/projects", "حالة غير صحيحة");
  await db.graduationProject.update({ where: { id }, data: { status, mentorName: mentorName || null, adminNote: adminNote || null } });
  if (status === "APPROVED" && p.status === "PROPOSED") await notifyUsers([p.userId], { title: "اعتماد موضوع مشروع التخرج", body: `${p.topic}${mentorName ? " — المرشد: " + mentorName : ""}`, url: "/app/project" });
  else if (adminNote && adminNote !== p.adminNote) await notifyUsers([p.userId], { title: "ملاحظة على مشروع التخرج", body: adminNote.slice(0, 120), url: "/app/project" });
  ok("/admin/projects", "تم تحديث المشروع");
}

export async function judgeProject(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const p = await db.graduationProject.findUnique({ where: { id } });
  if (!p) fail("/admin/projects", "المشروع غير موجود");
  const limits = { clarity: 5, grounding: 7, design: 8, integration: 5, presentation: 5 } as const;
  const data: Record<string, number> = {};
  for (const [k, max] of Object.entries(limits)) {
    const v = num(formData.get(k), -1);
    if (v < 0 || v > max) fail("/admin/projects", `درجة «${k}» يجب أن تكون بين 0 و${max}`);
    data[k] = v;
  }
  const judgeNote = str(formData.get("judgeNote"));
  await db.graduationProject.update({ where: { id }, data: { ...data, judgeNote: judgeNote || null, status: "JUDGED" } });
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  await notifyUsers([p.userId], { title: "نتيجة تحكيم مشروع التخرج", body: `${total} من 30`, url: "/app/project" });
  ok("/admin/projects", "تم حفظ التحكيم وإشعار المشارك");
}

// ——— الإشعارات ———
export async function sendNotification(formData: FormData) {
  await admin();
  const title = str(formData.get("title"));
  const body = str(formData.get("body"));
  const url = str(formData.get("url"));
  const target = str(formData.get("target")); // all | participants | mentors | user:<id>
  if (!title || !body) fail("/admin/notifications", "العنوان والنص إلزاميان");
  let ids: string[] = [];
  if (target === "all") ids = (await db.user.findMany({ where: { active: true }, select: { id: true } })).map((u) => u.id);
  else if (target === "participants") ids = (await db.user.findMany({ where: { active: true, role: "PARTICIPANT" }, select: { id: true } })).map((u) => u.id);
  else if (target === "mentors") ids = (await db.user.findMany({ where: { active: true, role: "MENTOR" }, select: { id: true } })).map((u) => u.id);
  else if (target.startsWith("user:")) ids = [target.slice(5)];
  const r = await notifyUsers(ids, { title, body, url: url || undefined });
  ok("/admin/notifications", `أُرسل الإشعار إلى ${r.inApp} مستخدم (${r.pushed} إشعار دفع)`);
}

// ——— قوائم التحقق لمراحل المشروع ———
export async function toggleChecklist(formData: FormData) {
  await admin();
  const group = str(formData.get("group"));
  const order = num(formData.get("order"), -1);
  const phase = PHASES.find((p) => p.key === group);
  if (!phase || order < 0 || order >= phase.tasks.length) return;
  const existing = await db.checklistItem.findUnique({ where: { group_order: { group, order } } });
  if (existing) await db.checklistItem.update({ where: { id: existing.id }, data: { done: !existing.done, doneAt: existing.done ? null : new Date() } });
  else await db.checklistItem.create({ data: { group, order, label: phase.tasks[order], done: true, doneAt: new Date() } });
  revalidatePath("/admin/phases");
}

export async function markAdminRead() {
  const me = await requireRole("ADMIN", "MENTOR");
  await db.notification.updateMany({ where: { userId: me.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/admin/notifications");
  revalidatePath("/mentor/notifications");
}

// ——— معاينة تجربة المشارك (قراءة فقط، بحساب المدير نفسه) ———
export async function startPreview() {
  await admin();
  const jar = await cookies();
  jar.set(PREVIEW_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect("/app");
}

export async function endPreview() {
  await requireRole("ADMIN");
  const jar = await cookies();
  jar.delete(PREVIEW_COOKIE);
  redirect("/admin");
}
