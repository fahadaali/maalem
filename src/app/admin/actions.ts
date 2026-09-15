"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { notifyUsers, notifyRole } from "@/lib/notify";
import { num, str } from "@/lib/utils";
import { formatHijri, keyToDate, todayKey } from "@/lib/dates";
import { cookies } from "next/headers";
import { PREVIEW_COOKIE } from "@/lib/roles";
import { PHASES } from "@/lib/program";
import { activeCohortId, cohortWhere, participantsWhere, requireCohortId } from "@/lib/cohort";
import { deleteObject } from "@/lib/storage";
import { computeGrades, levelFor } from "@/lib/grades";
import { saveEmailConfig, clearEmailConfig, sendEmail } from "@/lib/email";
import { SCHEDULE_KEYS, SCHEDULE_DEFAULTS } from "@/lib/ics";
import { getCompletionLevels, getProjectRubric } from "@/lib/content";
import { QUESTION_KINDS, TRUE_FALSE_OPTIONS } from "@/lib/quiz";
import { EXCUSE_KINDS, type ExcuseKind } from "@/lib/excuses";
import { dispatchReminder, isAudience } from "@/lib/reminders";
import { ensureProgramData } from "@/lib/setup";
import { dropPendingAttachment, removeAttachments } from "@/lib/attachments";
import { ACTIVITY_KINDS, isActivityKind } from "@/lib/activity";
import { isFolderColor } from "@/lib/folders";
import { isHelpAudience } from "@/lib/help";

function ok(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}
function fail(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);
}
const admin = () => requireRole("ADMIN");

/** وجهة العودة من حقل مخفي: تُقبل داخل مناطق المنصة فقط، لا رابطاً خارجياً */
function safeBack(raw: string, fallback: string): string {
  return /^\/(admin|mentor|app)(\/|\?|$)/.test(raw) ? raw : fallback;
}

/** الترتيب التالي لسؤال في اختبار: بعد أعلى ترتيب قائم، فلا يتكرر الترتيب بعد حذف سؤال من الوسط */
async function nextQuestionOrder(quizId: string): Promise<number> {
  const last = await db.question.findFirst({ where: { quizId }, orderBy: { order: "desc" }, select: { order: true } });
  return (last?.order ?? 0) + 1;
}

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
  const me = await admin();
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
  // لا يُقفل مدير المشروع حسابه بنفسه: تغيير دوره أو تعطيله يُخرجه فوراً ولا يعود
  if (id === me.id && (role !== "ADMIN" || !active)) fail(path, "لا يمكنك تغيير دور حسابك أو تعطيله وأنت مسجّل به");
  if (!(await db.user.findUnique({ where: { id }, select: { id: true } }))) fail("/admin/participants", "المستخدم غير موجود");
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
  if (!(await db.weeklyReport.findUnique({ where: { id }, select: { id: true } }))) fail("/admin/reports", "التقرير غير موجود");
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
  const id = str(formData.get("id"));
  // مرفقات التسليمات لا يحذفها تسلسل القاعدة، فتُحذف هنا مع ملفاتها
  await removeAttachments("SUBMISSION", id);
  await db.assignment.deleteMany({ where: { id } });
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

/** يقرأ سؤالاً من النموذج ويتحقق منه بحسب نوعه */
function readQuestion(formData: FormData, path: string) {
  const kind = str(formData.get("kind")) || "MCQ";
  if (!(kind in QUESTION_KINDS)) fail(path, "نوع سؤال غير معروف");
  const text = str(formData.get("text"));
  if (!text) fail(path, "اكتب نص السؤال");
  const explanation = str(formData.get("explanation")) || null;

  if (kind === "SHORT") {
    const answers = str(formData.get("answers")).split("|").map((a) => a.trim()).filter(Boolean);
    if (!answers.length) fail(path, "اكتب الإجابة المقبولة، ويفصل بين صورها الحرف |");
    return { kind, text, options: "[]", correctIndex: 0, answers: answers.join("|"), explanation };
  }
  if (kind === "TRUEFALSE") {
    const correctIndex = num(formData.get("correctIndex"), -1);
    if (correctIndex !== 0 && correctIndex !== 1) fail(path, "حدد: صواب أم خطأ");
    return { kind, text, options: JSON.stringify(TRUE_FALSE_OPTIONS), correctIndex, answers: null, explanation };
  }
  // تُحذف الخيارات الفارغة ويُعاد ربط الإجابة الصحيحة بموضعها الجديد، فلا تنزاح إن تُرك خيار في الوسط فارغاً
  const raw = [0, 1, 2, 3].map((i) => str(formData.get(`opt${i}`)));
  const chosen = num(formData.get("correctIndex"), -1);
  const options = raw.filter(Boolean);
  const correctIndex = chosen >= 0 && chosen < raw.length && raw[chosen] ? raw.slice(0, chosen).filter(Boolean).length : -1;
  if (options.length < 2) fail(path, "خياران على الأقل");
  if (correctIndex < 0) fail(path, "حدد الإجابة الصحيحة، ولا تكون خياراً فارغاً");
  return { kind, text, options: JSON.stringify(options), correctIndex, answers: null, explanation };
}

export async function addQuestion(formData: FormData) {
  await admin();
  const quizId = str(formData.get("quizId"));
  const path = `/admin/quizzes/${quizId}`;
  const q = readQuestion(formData, path);
  if (!(await db.quiz.findUnique({ where: { id: quizId }, select: { id: true } }))) fail("/admin/quizzes", "الاختبار غير موجود");
  const order = await nextQuestionOrder(quizId);
  await db.question.create({ data: { quizId, order, ...q } });
  if (str(formData.get("toBank")) === "on") {
    await db.bankQuestion.create({ data: { cohortId: await activeCohortId(), topic: str(formData.get("topic")) || "FIQH", week: str(formData.get("week")) === "" ? null : num(formData.get("week")), ...q } });
  }
  ok(path, "تمت إضافة السؤال");
}

// ——— بنك الأسئلة ———
export async function addBankQuestion(formData: FormData) {
  await admin();
  const q = readQuestion(formData, "/admin/bank");
  await db.bankQuestion.create({
    data: { cohortId: await activeCohortId(), topic: str(formData.get("topic")) || "FIQH", week: str(formData.get("week")) === "" ? null : num(formData.get("week")), ...q },
  });
  revalidatePath("/admin/bank");
  ok("/admin/bank", "أُضيف السؤال إلى البنك");
}

export async function deleteBankQuestion(formData: FormData) {
  await admin();
  await db.bankQuestion.delete({ where: { id: str(formData.get("id")) } }).catch(() => {});
  revalidatePath("/admin/bank");
  ok("/admin/bank", "حُذف السؤال من البنك");
}

/** نسخ أسئلة مختارة من البنك إلى اختبار */
export async function copyFromBank(formData: FormData) {
  await admin();
  const quizId = str(formData.get("quizId"));
  const path = `/admin/quizzes/${quizId}`;
  const ids = formData.getAll("pick").map((v) => String(v)).filter(Boolean);
  if (!ids.length) fail(path, "اختر سؤالاً واحداً على الأقل");
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { id: true } });
  if (!quiz) fail("/admin/quizzes", "الاختبار غير موجود");
  const rows = await db.bankQuestion.findMany({ where: { id: { in: ids } } });
  const start = await nextQuestionOrder(quizId);
  await db.question.createMany({
    data: rows.map((r, i) => ({ quizId, order: start + i, kind: r.kind, text: r.text, options: r.options, correctIndex: r.correctIndex, answers: r.answers, explanation: r.explanation })),
  });
  revalidatePath(path);
  ok(path, `نُسخ ${rows.length} سؤالاً من البنك`);
}

export async function deleteQuestion(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const q = await db.question.findUnique({ where: { id }, select: { quizId: true } });
  if (!q) return;
  await db.question.deleteMany({ where: { id } });
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
  await db.quiz.deleteMany({ where: { id: str(formData.get("id")) } });
  revalidatePath("/admin/quizzes");
  ok("/admin/quizzes", "تم حذف الاختبار");
}

// ——— المعايشة ———
export async function approveFieldLog(formData: FormData) {
  const me = await requireRole("ADMIN", "MENTOR");
  const id = str(formData.get("id"));
  const back = safeBack(str(formData.get("back")), me.role === "MENTOR" ? "/mentor" : "/admin/field");
  const log = await db.fieldLog.findUnique({ where: { id }, include: { user: true } });
  if (!log) fail(back, "السجل غير موجود");
  if (me.role === "MENTOR" && log.user.mentorId !== me.id) fail(back, "هذا المشارك ليس من مجموعتك");
  if (log.approvedAt) fail(back, "اعتُمد هذا السجل من قبل");
  await db.fieldLog.update({ where: { id }, data: { approvedAt: new Date(), approvedBy: me.id } });
  await notifyUsers([log.userId], { title: "اعتماد سجل معايشة", body: `اعتُمدت ${log.hours} ساعة معايشة.`, url: "/app/field" });
  revalidatePath(back);
  redirect(back);
}

export async function rejectFieldLog(formData: FormData) {
  const me = await requireRole("ADMIN", "MENTOR");
  const id = str(formData.get("id"));
  const back = safeBack(str(formData.get("back")), me.role === "MENTOR" ? "/mentor" : "/admin/field");
  const reason = str(formData.get("reason"));
  const log = await db.fieldLog.findUnique({ where: { id }, include: { user: true } });
  if (!log) fail(back, "السجل غير موجود");
  if (me.role === "MENTOR" && log.user.mentorId !== me.id) fail(back, "هذا المشارك ليس من مجموعتك");
  await removeAttachments("FIELD", id);
  await db.fieldLog.deleteMany({ where: { id } });
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
  // الحدود من سلّم التحكيم القابل للتعديل في «محتوى الوثيقة»، لا من أرقام ثابتة قد تخالفه
  const rubric = await getProjectRubric();
  const keys = ["clarity", "grounding", "design", "integration", "presentation"] as const;
  const data: Record<(typeof keys)[number], number> = { clarity: 0, grounding: 0, design: 0, integration: 0, presentation: 0 };
  for (const k of keys) {
    const max = rubric.find((r) => r.key === k)?.points ?? 0;
    const v = num(formData.get(k), -1);
    // الأعمدة صحيحة في القاعدة، فالكسور كانت تُبتر صامتةً ويُبلَّغ المشارك بمجموع يخالف المخزون
    if (!Number.isInteger(v) || v < 0 || v > max) fail("/admin/projects", `درجة «${rubric.find((r) => r.key === k)?.label ?? k}» عدد صحيح بين 0 و${max}`);
    data[k] = v;
  }
  const judgeNote = str(formData.get("judgeNote"));
  await db.graduationProject.update({ where: { id }, data: { ...data, judgeNote: judgeNote || null, status: "JUDGED" } });
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const projectMax = rubric.reduce((a, r) => a + r.points, 0);
  await notifyUsers([p.userId], { title: "نتيجة تحكيم مشروع التخرج", body: `${total} من ${projectMax}`, url: "/app/project" });
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
  else if (target.startsWith("user:")) {
    const u = await db.user.findUnique({ where: { id: target.slice(5) }, select: { id: true, active: true } });
    if (!u || !u.active) fail("/admin/notifications", "المستخدم المقصود غير موجود أو معطَّل");
    ids = [u.id];
  }
  if (!ids.length) fail("/admin/notifications", "لا مستقبلين لهذا الإشعار");
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
  const user = await admin();
  const id = str(formData.get("id"));
  const title = str(formData.get("title"));
  const kind = str(formData.get("kind"));
  const url = str(formData.get("url"));
  /**
   * الملف رُفع قبل هذا الإجراء إلى ‎/api/upload، ولا يصل هنا إلا معرّف مرفقه:
   * لإجراءات الخادم وحدها حدُّ حجمٍ للجسم، وتجاوزه يردّ 500 لا يفهمه عميل React
   * فيبقى النموذج على «جارٍ الحفظ…» أبداً بلا رسالة. والنموذج في الواجهة خطوة
   * واحدة كما كان، فلا يرى المدير هذا التقسيم.
   */
  const attachmentId = str(formData.get("attachmentId"));
  /** سقط التحقّق بعد رفع الملف: يُحذف فلا يبقى في التخزين ملفٌّ لا مادة له */
  const bail = async (msg: string): Promise<never> => {
    if (attachmentId) await dropPendingAttachment(attachmentId, user.id);
    fail("/admin/materials", msg);
  };
  if (!title) await bail("اكتب عنوان المادة");
  if (!MATERIAL_KINDS.has(kind)) await bail("نوع غير صحيح");
  if (url && !/^https?:\/\//i.test(url)) await bail("الرابط يجب أن يبدأ بـ http أو https");
  const data = {
    title,
    kind,
    author: str(formData.get("author")) || null,
    description: str(formData.get("description")) || null,
    url: url || null,
    competency: str(formData.get("competency")) || null,
    week: str(formData.get("week")) === "" ? null : num(formData.get("week")),
    order: num(formData.get("order"), 0),
    // «بلا مجلد» اختيارٌ صحيح لا نقص، فالحقل الفارغ يُحفظ فارغاً
    folderId: str(formData.get("folderId")) || null,
  };
  let refId = id;
  if (id) await db.material.update({ where: { id }, data });
  else {
    const created = await db.material.create({ data });
    refId = created.id;
  }
  /**
   * شرط `where` هو التفويض نفسه: مرفقُ صاحب الطلب، من نوع المادة، ولم يُربط بعد.
   * و`updateMany` فمعرّفٌ لا يطابق لا يرمي استثناءً بل لا يفعل شيئاً.
   */
  if (attachmentId) {
    await db.attachment.updateMany({
      where: { id: attachmentId, userId: user.id, kind: "MATERIAL", refId: null },
      data: { refId },
    });
  }
  // الإشعار بعد ربط الملف، فلا يصل المشارك إلى مادة لم يظهر ملفها بعد
  if (!id) await notifyRole("PARTICIPANT", { title: "مادة جديدة في المكتبة", body: title, url: "/app/materials" });
  revalidatePath("/admin/materials");
  revalidatePath("/app/materials");
  ok("/admin/materials", id ? "تم تحديث المادة" : `تمت إضافة المادة${attachmentId ? " وملفها" : ""} وإشعار المشاركين`);
}

export async function deleteMaterial(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const files = await db.attachment.findMany({ where: { kind: "MATERIAL", refId: id } });
  for (const f of files) {
    await deleteObject(f.key).catch(() => {});
    await db.attachment.delete({ where: { id: f.id } }).catch(() => {});
  }
  await db.material.deleteMany({ where: { id } });
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
  if (!(await db.programWeek.findUnique({ where: { cohortId_number: { cohortId, number } }, select: { id: true } }))) fail("/admin/schedule", "أسبوع غير موجود");
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
      field: str(formData.get("field")),
      meetingPlace: str(formData.get("meetingPlace")) || null,
      remoteUrl: remoteUrl || null,
      note: str(formData.get("note")) || null,
    },
  });
  revalidatePath("/admin/schedule");
  revalidatePath("/program/schedule");
  // بطاقة الأسبوع تُرسم من هذه الحقول في لوحة المشارك أيضاً
  revalidatePath("/app");
  revalidatePath("/app/week");
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
    date: keyToDate(/^\d{4}-\d{2}-\d{2}$/.test(str(formData.get("date"))) ? str(formData.get("date")) : todayKey()),
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
  await db.guest.deleteMany({ where: { id: str(formData.get("id")) } });
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
  const existing = id ? await db.budgetEntry.findUnique({ where: { id } }) : null;
  if (id && !existing) fail("/admin/budget", "البند غير موجود");
  const actual = actualRaw === "" ? null : num(formData.get("actual"), 0);
  const data = {
    item,
    basis: str(formData.get("basis")) || null,
    planned: num(formData.get("planned"), 0),
    actual,
    optional: formData.get("optional") === "on",
    note: str(formData.get("note")) || null,
    order: num(formData.get("order"), 0),
    // تاريخ الصرف يُثبَّت عند أول تسجيل للمبلغ الفعلي، ولا يُستبدل بكل حفظ لاحق
    spentAt: actual === null ? null : existing?.spentAt && existing.actual !== null ? existing.spentAt : new Date(),
  };
  if (data.planned < 0 || (data.actual ?? 0) < 0) fail("/admin/budget", "المبالغ لا تكون سالبة");
  if (id) await db.budgetEntry.update({ where: { id }, data });
  else await db.budgetEntry.create({ data: { ...data, cohortId: await activeCohortId() } });
  revalidatePath("/admin/budget");
  ok("/admin/budget", id ? "تم تحديث البند" : "تمت إضافة البند");
}

export async function deleteBudgetEntry(formData: FormData) {
  await admin();
  await db.budgetEntry.deleteMany({ where: { id: str(formData.get("id")) } });
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
  const lvl = await levelFor(total);
  const year = Number(todayKey().slice(0, 4));
  // من نال أقل من أدنى مستويات الإتمام يُمنح إفادة حضور لا وثيقة إتمام
  const levels = await getCompletionLevels();
  const passing = levels.filter((l) => l.min > 0).map((l) => l.min);
  const kind = total >= (passing.length ? Math.min(...passing) : 60) ? "COMPLETION" : "ATTENDANCE";
  const prefix = kind === "COMPLETION" ? "MAALEM" : "MAALEM-ATT";
  /**
   * الرقم التسلسلي يلي أعلى رقم صادر بهذه البادئة في هذه السنة، لا عدد الوثائق:
   * العدّ كان يعيد رقماً صادراً بعد سحب أي وثيقة فيصطدم بقيد التفرّد وتسقط الصفحة.
   */
  const stem = `${prefix}-${year}-`;
  const issued = await db.certificate.findMany({ where: { serial: { startsWith: stem } }, select: { serial: true } });
  const highest = issued.reduce((m, c) => {
    const n = Number(c.serial.slice(stem.length));
    return Number.isFinite(n) && /^\d+$/.test(c.serial.slice(stem.length)) ? Math.max(m, n) : m;
  }, 0);
  const serial = `${stem}${String(highest + 1).padStart(3, "0")}`;
  await db.certificate.upsert({
    where: { userId },
    create: { userId, kind, serial, level: lvl.level, total, note: str(formData.get("note")) || null },
    update: { kind, level: lvl.level, total, note: str(formData.get("note")) || null, issuedAt: new Date() },
  });
  await notifyUsers([userId], {
    title: kind === "COMPLETION" ? "صدرت وثيقة إتمامك" : "صدرت إفادة حضورك",
    body: `${lvl.level} — ${total} من ${g.maxes.continuous + g.maxes.project}`,
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
  const start = keyToDate(startDate).getTime();
  const { WEEKS, BUDGET } = await import("@/lib/program");
  await db.programWeek.createMany({
    data: WEEKS.map((w) => {
      /**
       * التاريخ بتوقيت الرياض لا بالتوقيت العالمي: منتصف ليل الرياض هو مساء اليوم
       * السابق عالمياً، فكانت أسابيع الدفعة الجديدة كلها تُسجَّل بيوم مبكر.
       * والتاريخ الهجري يُحسب من التاريخ الجديد لا يُنسخ من دفعة الخطة.
       */
      const day = new Date(start + w.number * 7 * 86400000);
      return {
        cohortId: cohort.id, number: w.number, label: w.label,
        hijri: formatHijri(day, { day: "numeric", month: "long" }),
        gregorian: todayKey(day),
        competency: w.competency, session: w.session, circle: w.circle, reading: w.reading, task: w.task,
        field: w.field,
      };
    }),
  });
  await db.budgetEntry.createMany({
    data: BUDGET.items.map((i, order) => ({ cohortId: cohort.id, item: i.item, basis: i.basis, planned: i.cost, optional: i.optional, note: i.note === "—" ? null : i.note, order })),
  });
  // بقية محتوى الوثيقة للدفعة الجديدة: الكتب والميثاق والأوزان والمستويات والكفاءات،
  // تُبذر الآن لا عند أول تشغيل تالٍ، فتكون قابلة للتحرير من ساعة إنشائها
  await ensureProgramData(cohort.id);
  ok("/admin/cohorts", `أُنشئت دفعة «${name}» بجدولها وميزانيتها ومحتوى وثيقتها. فعّلها للعمل عليها.`);
}

export async function activateCohort(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const target = await db.cohort.findUnique({ where: { id } });
  if (!target) fail("/admin/cohorts", "الدفعة غير موجودة");
  // الإغلاق له أثر: دفعة مغلقة لا تُفعَّل حتى يُعاد فتحها
  if (target.closedAt) fail("/admin/cohorts", "الدفعة مغلقة — أعد فتحها أولاً ثم فعّلها");
  await db.cohort.updateMany({ where: { active: true }, data: { active: false } });
  await db.cohort.update({ where: { id }, data: { active: true } });
  // دفعة أُنشئت قبل إتاحة تحرير محتوى الوثيقة قد تكون بلا كتب ولا ميثاق ولا أوزان.
  // تُستكمل هنا عند التفعيل، فلا يبقى ذلك معلّقاً على أول تشغيل تالٍ للخادم.
  await ensureProgramData(id);
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

// ——— التذكيرات المخصصة ———
export async function saveReminder(formData: FormData) {
  await admin();
  const title = str(formData.get("title"));
  const body = str(formData.get("body"));
  const url = str(formData.get("url"));
  const audience = str(formData.get("audience")) || "PARTICIPANTS";
  const userId = str(formData.get("userId")) || null;
  const date = str(formData.get("date"));
  const time = str(formData.get("time")) || "07:00";
  const channels = str(formData.get("channels")) === "PUSH_EMAIL" ? "PUSH_EMAIL" : "PUSH";
  if (!title || !body) fail("/admin/reminders", "اكتب عنوان التذكير ونصه");
  if (!isAudience(audience)) fail("/admin/reminders", "فئة غير صحيحة");
  if (audience === "ONE" && !userId) fail("/admin/reminders", "اختر المشارك المقصود");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) fail("/admin/reminders", "اختر تاريخ الإرسال ووقته");
  const sendAt = new Date(`${date}T${time}:00+03:00`);
  if (Number.isNaN(sendAt.getTime())) fail("/admin/reminders", "موعد غير صحيح");
  if (url && !/^(https?:\/\/|\/)/i.test(url)) fail("/admin/reminders", "الرابط يبدأ بـ / أو http");
  if (audience === "ONE") {
    const u = await db.user.findUnique({ where: { id: userId! }, select: { id: true, active: true } });
    if (!u || !u.active) fail("/admin/reminders", "المشارك المقصود غير موجود");
  }
  await db.reminder.create({
    data: { title, body, url: url || null, audience, userId: audience === "ONE" ? userId : null, sendAt, channels, cohortId: await activeCohortId() },
  });
  revalidatePath("/admin/reminders");
  ok("/admin/reminders", "جُدول التذكير");
}

export async function deleteReminder(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  await db.reminder.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/reminders");
  ok("/admin/reminders", "حُذف التذكير");
}

export async function sendReminderNow(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const r = await db.reminder.findUnique({ where: { id } });
  if (!r) fail("/admin/reminders", "التذكير غير موجود");
  if (r.sentAt) fail("/admin/reminders", "أُرسل من قبل");
  const res = await dispatchReminder(r);
  revalidatePath("/admin/reminders");
  ok("/admin/reminders", `أُرسل إلى ${res.inApp} مستخدماً (دفع: ${res.pushed}، بريد: ${res.emailed})`);
}

// ——— قناة البريد ———
export async function saveEmailSettings(formData: FormData) {
  await admin();
  const provider = str(formData.get("provider"));
  const apiKey = str(formData.get("apiKey"));
  const from = str(formData.get("from"));
  const fromName = str(formData.get("fromName"));
  if (from && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from)) fail("/admin/settings", "عنوان المُرسل غير صحيح");
  await saveEmailConfig({ provider, apiKey, from, fromName });
  revalidatePath("/admin/settings");
  ok("/admin/settings", "حُفظت إعدادات البريد");
}

export async function disableEmail() {
  await admin();
  await clearEmailConfig();
  revalidatePath("/admin/settings");
  ok("/admin/settings", "أُوقفت قناة البريد");
}

export async function sendTestEmail(formData: FormData) {
  const me = await admin();
  const to = str(formData.get("to"));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) fail("/admin/settings", "أدخل بريداً صحيحاً للتجربة");
  const sent = await sendEmail([to], "رسالة تجريبية من معالم التربية", `وصلتك هذه الرسالة من ${me.name} للتأكد من عمل قناة البريد.`);
  if (!sent) fail("/admin/settings", "تعذّر الإرسال — تحقق من المفتاح وعنوان المُرسل");
  ok("/admin/settings", `أُرسلت رسالة تجريبية إلى ${to}`);
}

// ——— مواعيد اللقاءات في التقويم ———
export async function saveScheduleTimes(formData: FormData) {
  await admin();
  const pairs: [string, string][] = [
    [SCHEDULE_KEYS.sessionTime, str(formData.get("sessionTime")) || SCHEDULE_DEFAULTS.sessionTime],
    [SCHEDULE_KEYS.sessionMinutes, String(num(formData.get("sessionMinutes"), SCHEDULE_DEFAULTS.sessionMinutes))],
    [SCHEDULE_KEYS.circleTime, str(formData.get("circleTime")) || SCHEDULE_DEFAULTS.circleTime],
    [SCHEDULE_KEYS.circleMinutes, String(num(formData.get("circleMinutes"), SCHEDULE_DEFAULTS.circleMinutes))],
  ];
  // يُتحقق من القيم كلها قبل أول كتابة، فلا يُحفظ وقت اللقاء ويُرفض وقت الحلقة
  for (const [k, v] of pairs) {
    if (k.endsWith("Time") && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail("/admin/schedule", "صيغة الوقت يجب أن تكون HH:MM");
    if (k.endsWith("Minutes") && !(Number(v) >= 5 && Number(v) <= 600)) fail("/admin/schedule", "المدة بين 5 و600 دقيقة");
  }
  for (const [k, v] of pairs) {
    await db.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } });
  }
  revalidatePath("/admin/schedule");
  ok("/admin/schedule", "حُفظت مواعيد اللقاءات، وستظهر في تقويمات المشاركين");
}

// ——— الإدخال الجماعي ———

/** نسخ حضور أسبوع سابق إلى الأسبوع الحالي، دون المساس بما رُصد فيه */
export async function copyAttendanceFromWeek(formData: FormData) {
  await admin();
  const week = num(formData.get("week"), -1);
  const from = num(formData.get("from"), -1);
  const path = `/admin/attendance?week=${week}`;
  if (week < 0 || week > 14 || from < 0 || from > 14) fail("/admin/attendance", "أسبوع غير صحيح");
  if (week === from) fail(path, "اختر أسبوعاً مختلفاً للنسخ منه");
  const ids = (await db.user.findMany({ where: await participantsWhere(), select: { id: true } })).map((u) => u.id);
  if (!ids.length) fail(path, "لا مشاركين في الدفعة");
  const source = await db.attendance.findMany({ where: { week: from, userId: { in: ids } } });
  if (!source.length) fail(path, `لا حضور مرصود في الأسبوع ${from}`);
  const existing = await db.attendance.findMany({ where: { week, userId: { in: ids } }, select: { userId: true, type: true } });
  const taken = new Set(existing.map((e) => `${e.userId}:${e.type}`));
  const rows = source.filter((s) => !taken.has(`${s.userId}:${s.type}`));
  if (!rows.length) fail(path, "كل السجلات مرصودة في هذا الأسبوع، ولم يُنسخ شيء");
  await db.attendance.createMany({
    data: rows.map((s) => ({ userId: s.userId, week, type: s.type, status: s.status, participation: s.participation, circleScore: s.circleScore })),
  });
  revalidatePath("/admin/attendance");
  ok(path, `نُسخ ${rows.length} سجلاً من الأسبوع ${from} — راجعها قبل الاعتماد`);
}

/** استيراد المشاركين من جدول ملصوق: الاسم، اسم المستخدم، كلمة المرور، الجوال، البريد */
export async function importParticipants(formData: FormData) {
  await admin();
  const raw = str(formData.get("rows"));
  const role = str(formData.get("role")) === "MENTOR" ? "MENTOR" : "PARTICIPANT";
  if (!raw.trim()) fail("/admin/participants", "الصق الصفوف أولاً");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 100) fail("/admin/participants", "الحد الأقصى 100 صف في المرة الواحدة");
  const cohortId = await activeCohortId();
  const added: string[] = [];
  const skipped: string[] = [];
  for (const line of lines) {
    const cells = line.split(/\t|,|\s*\|\s*|؛|;/).map((c) => c.trim());
    const [name, username, password, phone, email] = cells;
    if (!name || !username) { skipped.push(line.slice(0, 24)); continue; }
    const user = username.toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(user)) { skipped.push(name); continue; }
    if (password && password.length < 6) { skipped.push(name); continue; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped.push(name); continue; }
    if (await db.user.findUnique({ where: { username: user } })) { skipped.push(name); continue; }
    const pass = password || Math.random().toString(36).slice(2, 10);
    await db.user.create({
      data: { cohortId, name, username: user, role, phone: phone || null, email: email || null, passwordHash: await bcrypt.hash(pass, 10) },
    });
    added.push(password ? name : `${name} (كلمة المرور: ${pass})`);
  }
  revalidatePath("/admin/participants");
  if (!added.length) fail("/admin/participants", "لم يُضف أحد — تحقق من صيغة الصفوف وأسماء المستخدمين");
  const msg = `أُضيف ${added.length}: ${added.join(" · ")}` + (skipped.length ? ` — وتُخطي ${skipped.length}: ${skipped.join("، ")}` : "");
  ok("/admin/participants", msg.slice(0, 600));
}

// ——— تحرير محتوى الوثيقة ———

export async function saveBook(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const title = str(formData.get("title"));
  if (!title) fail("/admin/content", "اكتب عنوان الكتاب");
  const data = {
    title,
    author: str(formData.get("author")) || "—",
    pages: Math.max(0, num(formData.get("pages"), 0)),
    weeks: str(formData.get("weeks")) || "—",
    circle: str(formData.get("circle")) || "—",
    availability: str(formData.get("availability")) || "—",
    order: num(formData.get("order"), 0),
  };
  if (id) await db.programBook.update({ where: { id }, data });
  else await db.programBook.create({ data: { ...data, cohortId: await activeCohortId() } });
  revalidatePath("/admin/content");
  ok("/admin/content", id ? "حُدّث الكتاب" : "أُضيف الكتاب");
}

export async function deleteBook(formData: FormData) {
  await admin();
  await db.programBook.delete({ where: { id: str(formData.get("id")) } }).catch(() => {});
  revalidatePath("/admin/content");
  ok("/admin/content", "حُذف الكتاب");
}

export async function saveCharter(formData: FormData) {
  await admin();
  // الدفعة مضمونة: بلا دفعة نشطة كان الشرط الفارغ يمسح ميثاق كل الدفعات
  const cohortId = await requireCohortId();
  const items: string[] = [];
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("item_") && typeof v === "string" && v.trim()) items.push(v.trim());
  }
  const added = str(formData.get("newItem")).trim();
  if (added) items.push(added);
  if (!items.length) fail("/admin/content", "الميثاق لا يصح بلا بنود");
  await db.charterItem.deleteMany({ where: { cohortId } });
  await db.charterItem.createMany({ data: items.map((text, order) => ({ cohortId, order, text })) });
  revalidatePath("/admin/content");
  ok("/admin/content", `حُفظ الميثاق (${items.length} بنداً)`);
}

export async function saveAssessment(formData: FormData) {
  await admin();
  const rows = await db.assessmentItem.findMany({ where: await cohortWhere() });
  if (!rows.length) fail("/admin/content", "لم تُبذر مكوّنات التقويم بعد");
  // يُتحقق من الجدول كله قبل الكتابة، فلا يُحفظ نصفه ويُرفض نصفه
  const updates = rows.map((r) => {
    const points = num(formData.get(`points_${r.id}`), r.points);
    if (points < 0 || points > 100) fail("/admin/content", "الدرجة بين 0 و100");
    return {
      id: r.id,
      data: {
        points,
        label: str(formData.get(`label_${r.id}`)) || r.label,
        tool: r.kind === "CONTINUOUS" ? str(formData.get(`tool_${r.id}`)) || null : null,
        minimum: r.kind === "CONTINUOUS" ? str(formData.get(`minimum_${r.id}`)) || null : null,
        description: r.kind === "PROJECT" ? str(formData.get(`description_${r.id}`)) || null : null,
      },
    };
  });
  for (const u of updates) await db.assessmentItem.update({ where: { id: u.id }, data: u.data });
  revalidatePath("/admin/content");
  revalidatePath("/admin/grades");
  ok("/admin/content", "حُفظت أوزان التقويم، وأُعيد احتساب الدرجات عليها");
}

export async function saveLevels(formData: FormData) {
  await admin();
  const rows = await db.completionLevel.findMany({ where: await cohortWhere(), orderBy: { min: "desc" } });
  if (!rows.length) fail("/admin/content", "لم تُبذر مستويات الإتمام بعد");
  // يُتحقق من الجدول كله قبل الكتابة، فلا تُخزَّن حدود متكررة
  const updates = rows.map((r) => {
    const min = num(formData.get(`min_${r.id}`), r.min);
    if (min < 0 || min > 100) fail("/admin/content", "الحد الأدنى بين 0 و100");
    return { id: r.id, data: { min, level: str(formData.get(`level_${r.id}`)) || r.level, certificate: str(formData.get(`certificate_${r.id}`)) || r.certificate } };
  });
  const mins = updates.map((u) => u.data.min);
  if (new Set(mins).size !== mins.length) fail("/admin/content", "لا يصح تكرار الحد الأدنى بين مستويين");
  for (const u of updates) await db.completionLevel.update({ where: { id: u.id }, data: u.data });
  revalidatePath("/admin/content");
  ok("/admin/content", "حُفظت مستويات الإتمام");
}

export async function saveCompetency(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const slug = str(formData.get("slug")).toLowerCase();
  const weight = Number(str(formData.get("weight")) || "0");
  if (!name) fail("/admin/competencies", "اكتب اسم الكفاءة");
  if (!/^[a-z][a-z0-9_-]{1,30}$/.test(slug)) fail("/admin/competencies", "المعرّف: أحرف إنجليزية صغيرة وأرقام، يبدأ بحرف");
  if (!(weight >= 0 && weight <= 100)) fail("/admin/competencies", "الوزن بين 0 و100");
  const data = { name, slug, weight, order: num(formData.get("order"), 0), intro: str(formData.get("intro")) };
  if (id) await db.competencyDef.update({ where: { id }, data });
  else await db.competencyDef.create({ data: { ...data, cohortId: await activeCohortId() } });
  revalidatePath("/admin/competencies");
  ok("/admin/competencies", id ? "حُدّثت الكفاءة" : "أُضيفت الكفاءة");
}

export async function deleteCompetency(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const count = await db.competencyDef.count({ where: await cohortWhere() });
  if (count <= 1) fail("/admin/competencies", "لا يصح حذف آخر كفاءة");
  await db.competencyDef.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/competencies");
  ok("/admin/competencies", "حُذفت الكفاءة ومفرداتها");
}

export async function saveCompetencyItem(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const competencyId = str(formData.get("competencyId"));
  const title = str(formData.get("title"));
  const back = `/admin/competencies?c=${competencyId}`;
  if (!title) fail(back, "اكتب عنوان المفردة");
  const data = {
    title,
    program: str(formData.get("program")),
    indicator: str(formData.get("indicator")),
    tasks: str(formData.get("tasks")),
    schedule: str(formData.get("schedule")),
    cost: str(formData.get("cost")),
    evidence: str(formData.get("evidence")),
    refs: str(formData.get("refs")),
    order: num(formData.get("order"), 0),
  };
  if (!(await db.competencyDef.findUnique({ where: { id: competencyId }, select: { id: true } }))) fail("/admin/competencies", "الكفاءة غير موجودة");
  if (id) await db.competencyItemRow.update({ where: { id }, data });
  else await db.competencyItemRow.create({ data: { ...data, competencyId } });
  revalidatePath("/admin/competencies");
  ok(back, id ? "حُدّثت المفردة" : "أُضيفت المفردة");
}

export async function deleteCompetencyItem(formData: FormData) {
  await admin();
  const competencyId = str(formData.get("competencyId"));
  await db.competencyItemRow.delete({ where: { id: str(formData.get("id")) } }).catch(() => {});
  revalidatePath("/admin/competencies");
  ok(`/admin/competencies?c=${competencyId}`, "حُذفت المفردة");
}

// ——— البتّ في طلبات الاستئذان ———
export async function decideExcuse(formData: FormData) {
  const me = await admin();
  const id = str(formData.get("id"));
  const approve = str(formData.get("approve")) === "1";
  const decision = str(formData.get("decision")) || null;
  const row = await db.excuseRequest.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!row) fail("/admin/excuses", "الطلب غير موجود");
  if (row.status !== "PENDING") fail("/admin/excuses", "بُتّ في هذا الطلب من قبل");

  if (approve && row.week != null && row.kind.startsWith("ABSENCE")) {
    // الاستئذان المقبول يُرصد معذوراً، والمعذور لا يُحتسب عليه في نسبة الحضور
    const type = row.kind === "ABSENCE_REMOTE" ? "REMOTE" : "INPERSON";
    await db.attendance.upsert({
      where: { userId_week_type: { userId: row.userId, week: row.week, type } },
      create: { userId: row.userId, week: row.week, type, status: "EXCUSED", note: `استئذان معتمد: ${row.reason}`.slice(0, 180) },
      update: { status: "EXCUSED" },
    });
  }

  await db.excuseRequest.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED", decision, decidedBy: me.name, decidedAt: new Date() },
  });
  await notifyUsers([row.userId], {
    title: approve ? "قُبل طلبك" : "لم يُقبل طلبك",
    body: `${EXCUSE_KINDS[row.kind as ExcuseKind] ?? row.kind}${decision ? ` — ${decision}` : ""}`,
    url: "/app/excuses",
  });
  revalidatePath("/admin/excuses");
  revalidatePath("/admin/attendance");
  ok("/admin/excuses", approve ? `قُبل طلب ${row.user.name}` : `رُفض طلب ${row.user.name}`);
}

// ——— مركز الأنشطة: التراجع والإعادة ———

/**
 * التراجع عن إدخالٍ خاطئ — من مشاركٍ أو من مدير المشروع نفسه.
 *
 * لا يُمحى السجل وحسب: تُحفظ لقطته كاملة في سجل التراجع فيُعاد منها بضغطة، لأن
 * الخطأ في زرّ التراجع نفسه وارد، وضياع إدخال مشاركٍ بنقرةٍ لا يُستدرَك.
 * ويُشعَر صاحبه ليعلم أن إدخاله رُفع فيعيده صحيحاً.
 */
export async function undoActivity(formData: FormData) {
  const me = await admin();
  const kind = str(formData.get("kind"));
  const id = str(formData.get("id"));
  const back = safeBack(str(formData.get("back")), "/admin/activity");
  if (!isActivityKind(kind)) fail(back, "نوع إدخال غير معروف");
  const spec = ACTIVITY_KINDS[kind];

  const snap = await spec.undo(id).catch(() => null);
  if (!snap) fail(back, "لم يعد هذا الإدخال موجوداً — لعلّ أحداً تراجع عنه قبلك");

  await db.undoEntry.create({
    data: {
      kind, recordId: id, userId: snap.userId, userName: snap.userName,
      label: snap.label, detail: snap.detail ?? null,
      payload: JSON.stringify(snap.payload), at: snap.at, undoneBy: me.name,
    },
  });
  await notifyUsers([snap.userId], {
    title: "تراجَع مدير المشروع عن إدخال يخصّك",
    body: `${spec.label}: ${snap.label}. ${spec.undoNote}.`,
  });
  revalidatePath("/admin/activity");
  ok(back, `تم التراجع عن «${snap.label}» — تجده في سجل التراجع لإعادته`);
}

/** إعادة ما تُرُوجِع عنه من لقطته، كما كان بمعرّفه نفسه */
export async function restoreActivity(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const back = safeBack(str(formData.get("back")), "/admin/activity");
  const row = await db.undoEntry.findUnique({ where: { id } });
  if (!row) fail(back, "لا سجل تراجع بهذا المعرّف");
  if (row.restoredAt) fail(back, "أُعيد هذا الإدخال من قبل");
  if (!isActivityKind(row.kind)) fail(back, "نوع إدخال غير معروف");

  try {
    await ACTIVITY_KINDS[row.kind].restore(JSON.parse(row.payload) as Record<string, unknown>);
  } catch {
    // أشيع ما يمنع الإعادة: أدخل المشارك بديلاً بعد التراجع، والقيد يمنع إدخالين
    fail(back, "تعذّرت الإعادة — لعلّ إدخالاً جديداً حلّ مكانه. راجعه في صفحته أولاً");
  }
  await db.undoEntry.update({ where: { id }, data: { restoredAt: new Date() } });
  if (row.userId) {
    await notifyUsers([row.userId], { title: "أُعيد إدخالك", body: `${row.label} — عاد كما كان.` });
  }
  revalidatePath("/admin/activity");
  ok(back, `أُعيد «${row.label}»`);
}

// ——— مجلدات مكتبة المواد ———

/** ترتيبٌ بعد آخر مجلد، فلا يتكرر ترتيبٌ ولا يقفز مجلدٌ إلى الصدارة */
async function nextFolderOrder(): Promise<number> {
  const last = await db.materialFolder.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  return (last?.order ?? 0) + 1;
}

export async function createFolder(formData: FormData) {
  await admin();
  const name = str(formData.get("name"));
  const color = str(formData.get("color")) || "gray";
  const note = str(formData.get("note"));
  if (!name) fail("/admin/materials", "اكتب اسم المجلد");
  if (!isFolderColor(color)) fail("/admin/materials", "لون غير معروف");
  await db.materialFolder.create({ data: { name: name.slice(0, 60), color, note: note || null, order: await nextFolderOrder() } });
  revalidatePath("/admin/materials");
  revalidatePath("/app/materials");
  ok("/admin/materials", `أُنشئ مجلد «${name}»`);
}

export async function saveFolder(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const color = str(formData.get("color")) || "gray";
  const note = str(formData.get("note"));
  if (!name) fail("/admin/materials", "اكتب اسم المجلد");
  if (!isFolderColor(color)) fail("/admin/materials", "لون غير معروف");
  await db.materialFolder.update({ where: { id }, data: { name: name.slice(0, 60), color, note: note || null } });
  revalidatePath("/admin/materials");
  revalidatePath("/app/materials");
  ok("/admin/materials", "تم تحديث المجلد");
}

/**
 * تحريك المجلد: يُبادَل ترتيبه بترتيب جاره في الاتجاه المطلوب، فيبقى الترتيب
 * متّصلاً ولا يحتاج إعادة ترقيم القائمة كلها مع كل نقلة.
 */
export async function moveFolder(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const up = str(formData.get("dir")) === "up";
  const me = await db.materialFolder.findUnique({ where: { id } });
  if (!me) fail("/admin/materials", "المجلد غير موجود");
  const neighbour = await db.materialFolder.findFirst({
    where: up ? { order: { lt: me.order } } : { order: { gt: me.order } },
    orderBy: { order: up ? "desc" : "asc" },
  });
  if (!neighbour) ok("/admin/materials", "المجلد في طرف القائمة");
  await db.materialFolder.update({ where: { id: me.id }, data: { order: neighbour.order } });
  await db.materialFolder.update({ where: { id: neighbour.id }, data: { order: me.order } });
  revalidatePath("/admin/materials");
  revalidatePath("/app/materials");
  ok("/admin/materials", "تم ترتيب المجلدات");
}

/**
 * حذف المجلد لا يحذف مواده: تُنقل إلى «بلا مجلد» صراحةً قبل حذفه — لا اتّكالاً
 * على قيد المفتاح الأجنبي، فإنفاذه في D1 غير مضمون — فلا تختفي مادةٌ مع مجلدها.
 */
export async function deleteFolder(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const folder = await db.materialFolder.findUnique({ where: { id }, select: { name: true } });
  if (!folder) fail("/admin/materials", "المجلد غير موجود");
  const moved = await db.material.updateMany({ where: { folderId: id }, data: { folderId: null } });
  await db.materialFolder.delete({ where: { id } });
  revalidatePath("/admin/materials");
  revalidatePath("/app/materials");
  ok("/admin/materials", `حُذف مجلد «${folder.name}»${moved.count ? ` ونُقلت ${moved.count} مادة إلى «بلا مجلد»` : ""}`);
}

/** نقل مادة إلى مجلد أو إخراجها منه — الحقل الفارغ يعني «بلا مجلد» */
export async function moveMaterial(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const folderId = str(formData.get("folderId")) || null;
  if (folderId && !(await db.materialFolder.findUnique({ where: { id: folderId }, select: { id: true } }))) {
    fail("/admin/materials", "المجلد غير موجود");
  }
  await db.material.update({ where: { id }, data: { folderId } });
  revalidatePath("/admin/materials");
  revalidatePath("/app/materials");
  ok("/admin/materials", folderId ? "نُقلت المادة إلى المجلد" : "أُخرجت المادة من المجلد");
}

/** تحريك المادة داخل مجموعتها: المبادلة مع أقرب جار في المجلد نفسه */
export async function moveMaterialOrder(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const up = str(formData.get("dir")) === "up";
  const me = await db.material.findUnique({ where: { id } });
  if (!me) fail("/admin/materials", "المادة غير موجودة");
  const sameFolder = { folderId: me.folderId };
  /**
   * الترتيب وحده لا يفصل المتساويات — والمواد القديمة كلها على صفر — فيُقاس
   * بالترتيب ثم بزمن الإنشاء، كما تُقرأ القائمة نفسها.
   */
  const neighbour = await db.material.findFirst({
    where: {
      ...sameFolder,
      OR: up
        ? [{ order: { lt: me.order } }, { order: me.order, createdAt: { lt: me.createdAt } }]
        : [{ order: { gt: me.order } }, { order: me.order, createdAt: { gt: me.createdAt } }],
    },
    orderBy: up ? [{ order: "desc" }, { createdAt: "desc" }] : [{ order: "asc" }, { createdAt: "asc" }],
  });
  if (!neighbour) ok("/admin/materials", "المادة في طرف مجموعتها");
  // المتساويان في الترتيب يُفرَّق بينهما برقمين جديدين، وإلا بقيت المبادلة بلا أثر
  const [a, b] = me.order === neighbour.order ? (up ? [me.order - 1, neighbour.order] : [me.order + 1, neighbour.order]) : [neighbour.order, me.order];
  await db.material.update({ where: { id: me.id }, data: { order: a } });
  await db.material.update({ where: { id: neighbour.id }, data: { order: b } });
  revalidatePath("/admin/materials");
  revalidatePath("/app/materials");
  ok("/admin/materials", "تم ترتيب المواد");
}

// ——— مركز المساعدة ———

/** رابط بند المساعدة: مسارٌ داخل المنصة وحده، فلا يقود سؤالٌ إلى موقع خارجي */
function internalHref(raw: string): string | null {
  if (!raw) return null;
  return /^\/(?!\/)/.test(raw) ? raw.slice(0, 200) : null;
}

export async function saveHelpItem(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const audience = str(formData.get("audience")) || "ALL";
  const question = str(formData.get("question"));
  const answer = str(formData.get("answer"));
  const rawHref = str(formData.get("href"));
  if (!isHelpAudience(audience)) fail("/admin/help", "جمهور غير معروف");
  if (!question || !answer) fail("/admin/help", "السؤال وجوابه حقلان إلزاميان");
  if (rawHref && !internalHref(rawHref)) fail("/admin/help", "الرابط يجب أن يكون مساراً داخل المنصة يبدأ بـ /");
  const data = {
    audience, question: question.slice(0, 160), answer,
    href: internalHref(rawHref), hrefLabel: str(formData.get("hrefLabel")).slice(0, 40) || null,
  };
  if (id) await db.helpItem.update({ where: { id }, data });
  else {
    const last = await db.helpItem.findFirst({ where: { audience }, orderBy: { order: "desc" }, select: { order: true } });
    await db.helpItem.create({ data: { ...data, order: (last?.order ?? 0) + 1 } });
  }
  revalidatePath("/admin/help");
  revalidatePath("/app/help");
  revalidatePath("/mentor/help");
  ok("/admin/help", id ? "تم تحديث السؤال" : "أُضيف السؤال");
}

export async function deleteHelpItem(formData: FormData) {
  await admin();
  await db.helpItem.delete({ where: { id: str(formData.get("id")) } }).catch(() => {});
  revalidatePath("/admin/help");
  revalidatePath("/app/help");
  revalidatePath("/mentor/help");
  ok("/admin/help", "حُذف السؤال");
}

/** ترتيب السؤال داخل جمهوره: مبادلةٌ مع أقرب جار، كترتيب المواد والمجلدات */
export async function moveHelpItem(formData: FormData) {
  await admin();
  const id = str(formData.get("id"));
  const up = str(formData.get("dir")) === "up";
  const me = await db.helpItem.findUnique({ where: { id } });
  if (!me) fail("/admin/help", "السؤال غير موجود");
  const neighbour = await db.helpItem.findFirst({
    where: {
      audience: me.audience,
      OR: up
        ? [{ order: { lt: me.order } }, { order: me.order, createdAt: { lt: me.createdAt } }]
        : [{ order: { gt: me.order } }, { order: me.order, createdAt: { gt: me.createdAt } }],
    },
    orderBy: up ? [{ order: "desc" }, { createdAt: "desc" }] : [{ order: "asc" }, { createdAt: "asc" }],
  });
  if (!neighbour) ok("/admin/help", "السؤال في طرف قائمته");
  const [a, b] = me.order === neighbour.order ? (up ? [me.order - 1, neighbour.order] : [me.order + 1, neighbour.order]) : [neighbour.order, me.order];
  await db.helpItem.update({ where: { id: me.id }, data: { order: a } });
  await db.helpItem.update({ where: { id: neighbour.id }, data: { order: b } });
  revalidatePath("/admin/help");
  revalidatePath("/app/help");
  revalidatePath("/mentor/help");
  ok("/admin/help", "تم ترتيب الأسئلة");
}
