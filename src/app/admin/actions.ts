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
import { activeCohortId, cohortWhere, participantsWhere, requireCohortId } from "@/lib/cohort";
import { deleteObject } from "@/lib/storage";
import { computeGrades } from "@/lib/grades";
import { levelFor } from "@/lib/grades";

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
  await db.user.create({ data: { cohortId: await activeCohortId(), name, username, phone: phone || null, role, mentorId, passwordHash: await bcrypt.hash(password, 10) } });
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
  const entries: { userId: string; type: string; status: string; participation: number | null; circleScore: number | null }[] = [];
  for (const [k, v] of formData.entries()) {
    const m = k.match(/^att_([^_]+)_(INPERSON|REMOTE)$/);
    if (m && typeof v === "string") {
      const rating = (name: string) => {
        const raw = str(formData.get(`${name}_${m[1]}_${m[2]}`));
        const n = Number(raw);
        return raw === "" || !Number.isInteger(n) || n < 1 || n > 5 ? null : n;
      };
      entries.push({ userId: m[1], type: m[2], status: v, participation: rating("part"), circleScore: m[2] === "REMOTE" ? rating("circle") : null });
    }
  }
  await db.$transaction(
    entries.map((e) =>
      e.status === ""
        ? db.attendance.deleteMany({ where: { userId: e.userId, week, type: e.type } })
        : db.attendance.upsert({
            where: { userId_week_type: { userId: e.userId, week, type: e.type } },
            create: { userId: e.userId, week, type: e.type, status: e.status, participation: e.participation, circleScore: e.circleScore },
            update: { status: e.status, participation: e.participation, circleScore: e.circleScore },
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
  const a = await db.assignment.create({ data: { cohortId: await activeCohortId(), title, week, description: description || null, competency: competency || null, dueAt: new Date(dueAt + "+03:00") } });
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
  const q = await db.quiz.create({ data: { cohortId: await activeCohortId(), title, kind, week, passMark } });
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
  if (target === "all") ids = (await db.user.findMany({ where: { active: true, OR: [await cohortWhere(), { role: "ADMIN" }] }, select: { id: true } })).map((u) => u.id);
  else if (target === "participants") ids = (await db.user.findMany({ where: await participantsWhere(), select: { id: true } })).map((u) => u.id);
  else if (target === "mentors") ids = (await db.user.findMany({ where: { active: true, role: "MENTOR", ...(await cohortWhere()) }, select: { id: true } })).map((u) => u.id);
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

// ——— مكتبة المواد ———
const MATERIAL_KINDS = new Set(["BOOK", "TEMPLATE", "GUIDE", "LINK"]);

export async function saveMaterial(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const title = str(formData.get("title"));
  const kind = str(formData.get("kind"));
  const url = str(formData.get("url"));
  if (!title) fail("/admin/materials", "اكتب عنوان المادة");
  if (!MATERIAL_KINDS.has(kind)) fail("/admin/materials", "نوع غير صحيح");
  if (url && !/^https?:\/\//i.test(url)) fail("/admin/materials", "الرابط يجب أن يبدأ بـ http أو https");
  const data = {
    title,
    kind,
    author: str(formData.get("author")) || null,
    description: str(formData.get("description")) || null,
    url: url || null,
    competency: str(formData.get("competency")) || null,
    week: str(formData.get("week")) === "" ? null : num(formData.get("week")),
    order: num(formData.get("order"), 0),
  };
  if (id) await db.material.update({ where: { id }, data });
  else {
    const created = await db.material.create({ data });
    await notifyRole("PARTICIPANT", { title: "مادة جديدة في المكتبة", body: created.title, url: "/app/materials" });
  }
  revalidatePath("/admin/materials");
  ok("/admin/materials", id ? "تم تحديث المادة" : "تمت إضافة المادة وإشعار المشاركين");
}

export async function deleteMaterial(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const files = await db.attachment.findMany({ where: { kind: "MATERIAL", refId: id } });
  for (const f of files) {
    await deleteObject(f.key).catch(() => {});
    await db.attachment.delete({ where: { id: f.id } }).catch(() => {});
  }
  await db.material.delete({ where: { id } });
  revalidatePath("/admin/materials");
  ok("/admin/materials", "تم حذف المادة");
}

// ——— جدول البرنامج: تعديل أسبوع (المواعيد، اللقاء، الحلقة، الورد، المهمة، الروابط) ———
export async function saveWeek(formData: FormData) {
  await admin();
  const number = num(formData.get("number"), -99);
  const gregorian = str(formData.get("gregorian"));
  const remoteUrl = str(formData.get("remoteUrl"));
  if (number === -99) fail("/admin/schedule", "أسبوع غير صحيح");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gregorian)) fail("/admin/schedule", "تاريخ غير صحيح");
  if (remoteUrl && !/^https?:\/\//i.test(remoteUrl)) fail("/admin/schedule", "رابط الحلقة يجب أن يبدأ بـ http أو https");
  const cohortId = await requireCohortId();
  await db.programWeek.update({
    where: { cohortId_number: { cohortId, number } },
    data: {
      gregorian,
      hijri: str(formData.get("hijri")),
      competency: str(formData.get("competency")),
      session: str(formData.get("session")),
      circle: str(formData.get("circle")),
      reading: str(formData.get("reading")),
      task: str(formData.get("task")),
      meetingPlace: str(formData.get("meetingPlace")) || null,
      remoteUrl: remoteUrl || null,
      note: str(formData.get("note")) || null,
    },
  });
  revalidatePath("/admin/schedule");
  revalidatePath("/program/schedule");
  ok(`/admin/schedule?week=${number}`, "تم تحديث الأسبوع");
}

export async function notifyWeekChange(formData: FormData) {
  await admin();
  const number = num(formData.get("number"), -99);
  const w = await db.programWeek.findFirst({ where: { number, ...(await cohortWhere()) } });
  if (!w) fail("/admin/schedule", "أسبوع غير موجود");
  await notifyRole("PARTICIPANT", {
    title: `تحديث جدول الأسبوع ${w.label}`,
    body: `${w.session}${w.note ? " — " + w.note : ""}`,
    url: "/program/schedule",
  });
  ok(`/admin/schedule?week=${number}`, "أُرسل إشعار التحديث للمشاركين");
}

// ——— محاضر اللقاءات وحلقات النقاش ———
const MINUTES_TYPES = new Set(["INPERSON", "REMOTE", "MONTHLY"]);

export async function saveMinutes(formData: FormData) {
  await admin();
  const week = num(formData.get("week"), -99);
  const type = str(formData.get("type"));
  const minutes = str(formData.get("minutes"));
  const back = `/admin/minutes?week=${week}`;
  if (week === -99 || !MINUTES_TYPES.has(type)) fail("/admin/minutes", "بيانات غير صحيحة");
  if (!minutes) fail(back, "اكتب نص المحضر");
  const data = {
    date: keyToDate(str(formData.get("date")) || new Date().toISOString().slice(0, 10)),
    title: str(formData.get("title")) || null,
    guestName: str(formData.get("guestName")) || null,
    present: str(formData.get("present")) || null,
    minutes,
    decisions: str(formData.get("decisions")) || null,
  };
  const cohortId = await requireCohortId();
  await db.sessionMinutes.upsert({ where: { cohortId_week_type: { cohortId, week, type } }, create: { cohortId, week, type, ...data }, update: data });
  if (str(formData.get("notify")) === "on") {
    await notifyRole("PARTICIPANT", { title: `محضر ${type === "REMOTE" ? "حلقة النقاش" : "اللقاء"} — الأسبوع ${week}`, body: minutes.slice(0, 120), url: "/app/minutes" });
  }
  revalidatePath("/admin/minutes");
  ok(back, "تم حفظ المحضر");
}

export async function deleteMinutes(formData: FormData) {
  await admin();
  const week = num(formData.get("week"), -99);
  const type = str(formData.get("type"));
  await db.sessionMinutes.deleteMany({ where: { week, type, ...(await cohortWhere()) } });
  revalidatePath("/admin/minutes");
  ok(`/admin/minutes?week=${week}`, "تم حذف المحضر");
}

// ——— الخبراء وضيوف اللقاءات ———
export async function saveGuest(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const topic = str(formData.get("topic"));
  if (!name || !topic) fail("/admin/guests", "الاسم والموضوع حقلان إلزاميان");
  const status = str(formData.get("status")) || "CANDIDATE";
  if (!["CANDIDATE", "CONFIRMED", "DONE", "DECLINED"].includes(status)) fail("/admin/guests", "حالة غير صحيحة");
  const data = {
    name, topic, status,
    week: str(formData.get("week")) === "" ? null : num(formData.get("week")),
    contact: str(formData.get("contact")) || null,
    backup: formData.get("backup") === "on",
    notes: str(formData.get("notes")) || null,
  };
  if (id) await db.guest.update({ where: { id }, data });
  else await db.guest.create({ data: { ...data, cohortId: await activeCohortId() } });
  revalidatePath("/admin/guests");
  ok("/admin/guests", id ? "تم تحديث بيانات الضيف" : "تمت إضافة الضيف");
}

export async function deleteGuest(formData: FormData) {
  await admin();
  await db.guest.delete({ where: { id: str(formData.get("id")) } });
  revalidatePath("/admin/guests");
  ok("/admin/guests", "تم حذف الضيف");
}

// ——— الميزانية: المقدّر مقابل الفعلي ———
export async function saveBudgetEntry(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const item = str(formData.get("item"));
  if (!item) fail("/admin/budget", "اكتب اسم البند");
  const actualRaw = str(formData.get("actual"));
  const data = {
    item,
    basis: str(formData.get("basis")) || null,
    planned: num(formData.get("planned"), 0),
    actual: actualRaw === "" ? null : num(formData.get("actual"), 0),
    optional: formData.get("optional") === "on",
    note: str(formData.get("note")) || null,
    order: num(formData.get("order"), 0),
    spentAt: actualRaw === "" ? null : new Date(),
  };
  if (data.planned < 0 || (data.actual ?? 0) < 0) fail("/admin/budget", "المبالغ لا تكون سالبة");
  if (id) await db.budgetEntry.update({ where: { id }, data });
  else await db.budgetEntry.create({ data: { ...data, cohortId: await activeCohortId() } });
  revalidatePath("/admin/budget");
  ok("/admin/budget", id ? "تم تحديث البند" : "تمت إضافة البند");
}

export async function deleteBudgetEntry(formData: FormData) {
  await admin();
  await db.budgetEntry.delete({ where: { id: str(formData.get("id")) } });
  revalidatePath("/admin/budget");
  ok("/admin/budget", "تم حذف البند");
}

// ——— تقارير الجهة: الشهري والختامي ———
export async function saveProgramReport(formData: FormData) {
  await admin();
  const kind = str(formData.get("kind")) === "FINAL" ? "FINAL" : "MONTHLY";
  const period = str(formData.get("period"));
  const summary = str(formData.get("summary"));
  if (!period) fail("/admin/program-reports", "حدد الفترة");
  if (!summary) fail("/admin/program-reports", "اكتب ملخص التقرير");
  const data = {
    summary,
    highlights: str(formData.get("highlights")) || null,
    challenges: str(formData.get("challenges")) || null,
    lessons: str(formData.get("lessons")) || null,
    recommendations: str(formData.get("recommendations")) || null,
    snapshot: str(formData.get("snapshot")) || null,
  };
  const cohortId = await requireCohortId();
  await db.programReport.upsert({ where: { cohortId_kind_period: { cohortId, kind, period } }, create: { cohortId, kind, period, ...data }, update: data });
  revalidatePath("/admin/program-reports");
  ok(`/admin/program-reports?kind=${kind}&period=${encodeURIComponent(period)}`, "تم حفظ التقرير");
}

// ——— اعتماد الدرجات النهائية ———
export async function approveFinalGrade(formData: FormData) {
  const me = await admin();
  const userId = str(formData.get("userId"));
  const adjustment = Number(str(formData.get("adjustment")) || "0");
  const reason = str(formData.get("reason"));
  if (!Number.isFinite(adjustment) || Math.abs(adjustment) > 20) fail("/admin/grades", "التعديل بين -20 و20 درجة");
  if (adjustment !== 0 && !reason) fail("/admin/grades", "اكتب مسوّغ التعديل");
  const g = await computeGrades(userId);
  const total = Math.max(0, Math.min(100, Math.round((g.total + adjustment) * 10) / 10));
  const breakdown = JSON.stringify({
    attendance: g.attendance, reading: g.reading, quizzes: g.quizzes, tasks: g.tasks,
    field: g.field, leadership: g.leadership, continuous: g.continuous, project: g.project, total,
  });
  await db.finalGrade.upsert({
    where: { userId },
    create: { userId, computed: g.total, adjustment, reason: reason || null, breakdown, approvedBy: me.id },
    update: { computed: g.total, adjustment, reason: reason || null, breakdown, approvedBy: me.id, approvedAt: new Date() },
  });
  await notifyUsers([userId], { title: "اعتماد الدرجة النهائية", body: `درجتك النهائية ${total} من 100`, url: "/app/portfolio" });
  revalidatePath("/admin/grades");
  ok("/admin/grades", "تم اعتماد الدرجة النهائية");
}

export async function reopenFinalGrade(formData: FormData) {
  await admin();
  await db.finalGrade.deleteMany({ where: { userId: str(formData.get("userId")) } });
  revalidatePath("/admin/grades");
  ok("/admin/grades", "أُلغي الاعتماد وعادت الدرجة للاحتساب الآلي");
}

// ——— إعادة فتح اختبار لمشارك ———
export async function resetQuizAttempt(formData: FormData) {
  await admin();
  const quizId = str(formData.get("quizId"));
  const userId = str(formData.get("userId"));
  const reason = str(formData.get("reason"));
  if (!reason) fail(`/admin/quizzes/${quizId}`, "اكتب سبب إعادة الفتح");
  await db.quizAttempt.deleteMany({ where: { quizId, userId } });
  await notifyUsers([userId], { title: "أُعيد فتح اختبار لك", body: reason, url: `/app/quizzes/${quizId}` });
  ok(`/admin/quizzes/${quizId}`, "أُعيد فتح الاختبار وأُشعر المشارك");
}

// ——— وثائق الإتمام وإفادات الحضور ———
export async function issueCertificate(formData: FormData) {
  await admin();
  const userId = str(formData.get("userId"));
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (!user || user.role !== "PARTICIPANT") fail("/admin/certificates", "المشارك غير موجود");
  const final = await db.finalGrade.findUnique({ where: { userId } });
  const g = await computeGrades(userId);
  const total = final ? Math.max(0, Math.min(100, Math.round((final.computed + final.adjustment) * 10) / 10)) : g.total;
  const lvl = levelFor(total);
  const year = new Date().getFullYear();
  const count = (await db.certificate.count()) + 1;
  // من نال أقل من 60 يُمنح إفادة حضور لا وثيقة إتمام، كما في الخطة
  const kind = total >= 60 ? "COMPLETION" : "ATTENDANCE";
  const prefix = kind === "COMPLETION" ? "MAALEM" : "MAALEM-ATT";
  const serial = `${prefix}-${year}-${String(count).padStart(3, "0")}`;
  await db.certificate.upsert({
    where: { userId },
    create: { userId, kind, serial, level: lvl.level, total, note: str(formData.get("note")) || null },
    update: { kind, level: lvl.level, total, note: str(formData.get("note")) || null, issuedAt: new Date() },
  });
  await notifyUsers([userId], {
    title: kind === "COMPLETION" ? "صدرت وثيقة إتمامك" : "صدرت إفادة حضورك",
    body: `${lvl.level} — ${total} من 100`,
    url: "/app/certificate",
  });
  revalidatePath("/admin/certificates");
  ok("/admin/certificates", `صدرت وثيقة ${user!.name}`);
}

export async function revokeCertificate(formData: FormData) {
  await admin();
  await db.certificate.deleteMany({ where: { userId: str(formData.get("userId")) } });
  revalidatePath("/admin/certificates");
  ok("/admin/certificates", "تم سحب الوثيقة");
}

// ——— الدفعات ———
export async function createCohort(formData: FormData) {
  await admin();
  const name = str(formData.get("name"));
  const startDate = str(formData.get("startDate"));
  if (!name) fail("/admin/cohorts", "اكتب اسم الدفعة");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) fail("/admin/cohorts", "حدد تاريخ اللقاء الافتتاحي");
  if (await db.cohort.findUnique({ where: { name } })) fail("/admin/cohorts", "اسم الدفعة مستخدم من قبل");
  const cohort = await db.cohort.create({ data: { name, startDate } });
  // أسابيع الدفعة الجديدة من الخطة، بمواعيد تبدأ من تاريخ لقائها الافتتاحي
  const start = new Date(`${startDate}T00:00:00+03:00`).getTime();
  const { WEEKS, BUDGET } = await import("@/lib/program");
  for (const w of WEEKS) {
    const d = new Date(start + w.number * 7 * 86400000).toISOString().slice(0, 10);
    await db.programWeek.create({
      data: { cohortId: cohort.id, number: w.number, label: w.label, hijri: w.hijri, gregorian: d, competency: w.competency, session: w.session, circle: w.circle, reading: w.reading, task: w.task },
    });
  }
  let order = 0;
  for (const i of BUDGET.items) {
    await db.budgetEntry.create({ data: { cohortId: cohort.id, item: i.item, basis: i.basis, planned: i.cost, optional: i.optional, note: i.note === "—" ? null : i.note, order: order++ } });
  }
  ok("/admin/cohorts", `أُنشئت دفعة «${name}» بجدولها وميزانيتها. فعّلها للعمل عليها.`);
}

export async function activateCohort(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const target = await db.cohort.findUnique({ where: { id } });
  if (!target) fail("/admin/cohorts", "الدفعة غير موجودة");
  await db.cohort.updateMany({ where: { active: true }, data: { active: false } });
  await db.cohort.update({ where: { id }, data: { active: true } });
  revalidatePath("/admin");
  ok("/admin/cohorts", `الدفعة النشطة الآن: ${target.name}`);
}

export async function closeCohort(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const c = await db.cohort.findUnique({ where: { id } });
  if (!c) fail("/admin/cohorts", "الدفعة غير موجودة");
  await db.cohort.update({ where: { id }, data: { closedAt: c.closedAt ? null : new Date() } });
  ok("/admin/cohorts", c.closedAt ? "أُعيد فتح الدفعة" : "أُغلقت الدفعة");
}

// ——— تقييم المشرف المرافق للمشارك ———
const EVAL_PERIODS = ["منتصف البرنامج", "ختامي"];

export async function saveMentorEvaluation(formData: FormData) {
  const me = await requireRole("MENTOR", "ADMIN");
  const userId = str(formData.get("userId"));
  const period = str(formData.get("period"));
  const back = me.role === "MENTOR" ? "/mentor" : `/admin/participants/${userId}`;
  if (!EVAL_PERIODS.includes(period)) fail(back, "فترة تقييم غير صحيحة");
  const participant = await db.user.findUnique({ where: { id: userId }, select: { mentorId: true, role: true, name: true } });
  if (!participant || participant.role !== "PARTICIPANT") fail(back, "المشارك غير موجود");
  if (me.role === "MENTOR" && participant.mentorId !== me.id) fail(back, "هذا المشارك ليس من مجموعتك");
  const keys = ["regularity", "engagement", "application", "conduct", "growth"] as const;
  const scores: Record<string, number> = {};
  for (const k of keys) {
    const v = num(formData.get(k), 0);
    if (v < 1 || v > 5) fail(back, "قيّم كل معيار من 1 إلى 5");
    scores[k] = v;
  }
  const data = { ...scores, notes: str(formData.get("notes")) || null, mentorId: me.id } as {
    regularity: number; engagement: number; application: number; conduct: number; growth: number; notes: string | null; mentorId: string;
  };
  await db.mentorEvaluation.upsert({
    where: { userId_period: { userId, period } },
    create: { userId, period, ...data },
    update: data,
  });
  await notifyUsers([userId], { title: "تقييم المشرف المرافق", body: `سُجّل تقييم ${period} لمعايشتك الميدانية`, url: "/app/field" });
  revalidatePath(back);
  ok(back, `تم حفظ تقييم ${participant.name}`);
}
