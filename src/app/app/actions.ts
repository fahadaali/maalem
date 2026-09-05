"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/roles";
import { isPreview, requireRole, requireUser } from "@/lib/auth";
import { notifyAdmins, notifyUsers } from "@/lib/notify";
import { keyToDate, todayKey } from "@/lib/dates";
import { num, str } from "@/lib/utils";

function ok(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}
function fail(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);
}

/** كل إجراءات المشارك تمرّ من هنا: وضع المعاينة للقراءة فقط فلا يكتب شيئاً */
async function participant() {
  const user = await requireUser();
  if (user.role === "PARTICIPANT") return user;
  if (user.role === "ADMIN" && (await isPreview())) {
    redirect("/app?err=" + encodeURIComponent("وضع المعاينة للقراءة فقط — لم يُحفظ أي تغيير"));
  }
  redirect(homeFor(user.role));
}

// ——— بطاقة القراءة اليومية ———
export async function addReadingCard(formData: FormData) {
  const user = await participant();
  const dateKey = str(formData.get("date")) || todayKey();
  const book = str(formData.get("book")) === "__other" ? str(formData.get("bookOther")) : str(formData.get("book"));
  const fromPage = num(formData.get("fromPage"));
  const toPage = num(formData.get("toPage"));
  const benefit = str(formData.get("benefit"));
  const question = str(formData.get("question"));
  if (!book || !benefit) fail("/app/reading", "الكتاب وأهم فائدة حقلان إلزاميان");
  if (toPage < fromPage) fail("/app/reading", "رقم الصفحة الأخيرة يجب ألا يقل عن الأولى");
  await db.readingCard.create({ data: { userId: user.id, date: keyToDate(dateKey), book, fromPage, toPage, benefit, question: question || null } });
  revalidatePath("/app");
  ok("/app/reading", "تم حفظ بطاقة القراءة");
}

export async function deleteReadingCard(formData: FormData) {
  const user = await participant();
  const id = str(formData.get("id"));
  await db.readingCard.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/app/reading");
}

// ——— التقرير الأسبوعي ———
export async function saveWeeklyReport(formData: FormData) {
  const user = await participant();
  const week = num(formData.get("week"), -1);
  const path = `/app/reports/${week}`;
  if (week < 0 || week > 13) fail("/app/reports", "أسبوع غير صحيح");
  const data = {
    reading: str(formData.get("reading")),
    benefits: str(formData.get("benefits")),
    taskProgress: str(formData.get("taskProgress")),
    fieldNote: str(formData.get("fieldNote")) || null,
    quizResult: str(formData.get("quizResult")) || null,
    application: str(formData.get("application")) || null,
    difficulty: str(formData.get("difficulty")) || null,
  };
  if (!data.reading || !data.benefits || !data.taskProgress) fail(path, "الورد المنجز والفوائد والمهمة الأسبوعية حقول إلزامية");
  const existing = await db.weeklyReport.findUnique({ where: { userId_week: { userId: user.id, week } } });
  await db.weeklyReport.upsert({
    where: { userId_week: { userId: user.id, week } },
    create: { userId: user.id, week, ...data },
    update: { ...data, submittedAt: new Date() },
  });
  if (!existing) {
    await notifyAdmins({ title: "تقرير أسبوعي جديد", body: `${user.name} سلّم تقرير الأسبوع ${week}`, url: `/admin/reports?week=${week}` });
  }
  revalidatePath("/app");
  ok(path, "تم حفظ التقرير الأسبوعي");
}

// ——— الاختبارات التكوينية ———
export async function submitQuiz(formData: FormData) {
  const user = await participant();
  const quizId = str(formData.get("quizId"));
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, include: { questions: { orderBy: { order: "asc" } } } });
  if (!quiz || !quiz.published) fail("/app/quizzes", "الاختبار غير متاح");
  const existing = await db.quizAttempt.findUnique({ where: { quizId_userId: { quizId, userId: user.id } } });
  if (existing) fail(`/app/quizzes/${quizId}`, "سبق أن أديت هذا الاختبار");
  const answers = quiz.questions.map((q) => num(formData.get(`q_${q.id}`), -1));
  const score = quiz.questions.reduce((s, q, i) => s + (answers[i] === q.correctIndex ? 1 : 0), 0);
  await db.quizAttempt.create({ data: { quizId, userId: user.id, score, total: quiz.questions.length, answers: JSON.stringify(answers) } });
  revalidatePath("/app");
  redirect(`/app/quizzes/${quizId}`);
}

// ——— المهام الأسبوعية ———
export async function submitAssignment(formData: FormData) {
  const user = await participant();
  const assignmentId = str(formData.get("assignmentId"));
  const content = str(formData.get("content"));
  const link = str(formData.get("link"));
  const path = `/app/tasks/${assignmentId}`;
  if (!content) fail(path, "اكتب وصف ما أنجزته");
  if (link && !/^https?:\/\//i.test(link)) fail(path, "الرابط يجب أن يبدأ بـ http أو https");
  const assignment = await db.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) fail("/app/tasks", "المهمة غير موجودة");
  const existing = await db.submission.findUnique({ where: { assignmentId_userId: { assignmentId, userId: user.id } } });
  if (existing?.gradedAt) fail(path, "تم تقييم هذه المهمة ولا يمكن تعديلها");
  await db.submission.upsert({
    where: { assignmentId_userId: { assignmentId, userId: user.id } },
    create: { assignmentId, userId: user.id, content, link: link || null },
    update: { content, link: link || null, submittedAt: new Date() },
  });
  if (!existing) await notifyAdmins({ title: "تسليم مهمة", body: `${user.name} سلّم: ${assignment!.title}`, url: `/admin/tasks/${assignmentId}` });
  revalidatePath("/app");
  ok(path, "تم تسليم المهمة");
}

// ——— المعايشة الميدانية ———
export async function addFieldLog(formData: FormData) {
  const user = await participant();
  const dateKey = str(formData.get("date")) || todayKey();
  const hours = num(formData.get("hours"));
  const mentorName = str(formData.get("mentorName"));
  const note = str(formData.get("note"));
  if (hours <= 0 || hours > 12) fail("/app/field", "أدخل عدد ساعات صحيحاً");
  if (!mentorName || !note) fail("/app/field", "اسم المشرف المرافق والملاحظة حقلان إلزاميان");
  await db.fieldLog.create({ data: { userId: user.id, date: keyToDate(dateKey), hours, mentorName, note } });
  const me = await db.user.findUnique({ where: { id: user.id }, select: { mentorId: true } });
  const targets = await db.user.findMany({ where: { OR: [{ role: "ADMIN" }, ...(me?.mentorId ? [{ id: me.mentorId }] : [])], active: true }, select: { id: true } });
  await notifyUsers(targets.map((t) => t.id), { title: "سجل معايشة جديد", body: `${user.name} وثّق ${hours} ساعة معايشة بانتظار الاعتماد`, url: "/admin/field" });
  revalidatePath("/app");
  ok("/app/field", "تم تسجيل المعايشة وبانتظار اعتمادها");
}

export async function deleteFieldLog(formData: FormData) {
  const user = await participant();
  const id = str(formData.get("id"));
  await db.fieldLog.deleteMany({ where: { id, userId: user.id, approvedAt: null } });
  revalidatePath("/app/field");
}

// ——— الدور القيادي وتقييم الأقران ———
export async function addLeadershipActivity(formData: FormData) {
  const user = await participant();
  const title = str(formData.get("title"));
  const dateKey = str(formData.get("date")) || todayKey();
  const report = str(formData.get("report"));
  if (!title) fail("/app/leadership", "اكتب عنوان النشاط");
  await db.leadershipActivity.create({ data: { userId: user.id, title, date: keyToDate(dateKey), report: report || null } });
  const peers = await db.user.findMany({ where: { role: "PARTICIPANT", active: true, id: { not: user.id } }, select: { id: true } });
  await notifyUsers(peers.map((p) => p.id), { title: "تقييم أقران مطلوب", body: `${user.name} قاد نشاطاً: ${title}. شارك بتقييمك.`, url: "/app/leadership" });
  revalidatePath("/app");
  ok("/app/leadership", "تم تسجيل النشاط القيادي وإشعار الأقران لتقييمه");
}

export async function updateLeadershipReport(formData: FormData) {
  const user = await participant();
  const id = str(formData.get("id"));
  const report = str(formData.get("report"));
  await db.leadershipActivity.updateMany({ where: { id, userId: user.id }, data: { report: report || null } });
  ok("/app/leadership", "تم تحديث تقرير النشاط");
}

export async function submitPeerEvaluation(formData: FormData) {
  const user = await participant();
  const activityId = str(formData.get("activityId"));
  const activity = await db.leadershipActivity.findUnique({ where: { id: activityId } });
  if (!activity || activity.userId === user.id) fail("/app/leadership", "لا يمكن تقييم هذا النشاط");
  const vals = ["c1", "c2", "c3", "c4", "c5"].map((k) => num(formData.get(k)));
  if (vals.some((v) => v < 1 || v > 5)) fail("/app/leadership", "قيّم كل معيار من 1 إلى 5");
  await db.peerEvaluation.upsert({
    where: { activityId_evaluatorId: { activityId, evaluatorId: user.id } },
    create: { activityId, evaluatorId: user.id, c1: vals[0], c2: vals[1], c3: vals[2], c4: vals[3], c5: vals[4], comment: str(formData.get("comment")) || null },
    update: { c1: vals[0], c2: vals[1], c3: vals[2], c4: vals[3], c5: vals[4], comment: str(formData.get("comment")) || null },
  });
  revalidatePath("/app/leadership");
  ok("/app/leadership", "شكراً، تم حفظ تقييمك");
}

// ——— مشروع التخرج ———
export async function saveProject(formData: FormData) {
  const user = await participant();
  const topic = str(formData.get("topic"));
  const problem = str(formData.get("problem"));
  const draftLink = str(formData.get("draftLink"));
  const finalLink = str(formData.get("finalLink"));
  if (!topic) fail("/app/project", "اكتب موضوع المشروع");
  for (const l of [draftLink, finalLink]) if (l && !/^https?:\/\//i.test(l)) fail("/app/project", "الروابط يجب أن تبدأ بـ http أو https");
  const existing = await db.graduationProject.findUnique({ where: { userId: user.id } });
  let status = existing?.status ?? "PROPOSED";
  if (status === "JUDGED") fail("/app/project", "تم تحكيم المشروع ولا يمكن تعديله");
  if (finalLink && status !== "PROPOSED") status = "FINAL";
  else if (draftLink && status !== "PROPOSED") status = "DRAFT";
  const changedTopic = existing && existing.topic !== topic;
  if (changedTopic && existing.status !== "PROPOSED") status = "PROPOSED";
  await db.graduationProject.upsert({
    where: { userId: user.id },
    create: { userId: user.id, topic, problem: problem || null, draftLink: draftLink || null, finalLink: finalLink || null, status: "PROPOSED" },
    update: { topic, problem: problem || null, draftLink: draftLink || null, finalLink: finalLink || null, status },
  });
  if (!existing || changedTopic) await notifyAdmins({ title: "موضوع مشروع تخرج", body: `${user.name}: ${topic}`, url: "/admin/projects" });
  else if (status === "DRAFT" && existing.status !== "DRAFT") await notifyAdmins({ title: "مسودة مشروع تخرج", body: `${user.name} سلّم مسودة المشروع`, url: "/admin/projects" });
  else if (status === "FINAL" && existing.status !== "FINAL") await notifyAdmins({ title: "النسخة النهائية لمشروع التخرج", body: `${user.name} سلّم النسخة النهائية`, url: "/admin/projects" });
  revalidatePath("/app");
  ok("/app/project", "تم حفظ بيانات المشروع");
}

// ——— خطة التعلم الشخصية والوقفات التدبرية ———
export async function saveLearningPlan(formData: FormData) {
  const user = await participant();
  const goals = str(formData.get("goals"));
  const weeklyPlan = str(formData.get("weeklyPlan"));
  const memorization = str(formData.get("memorization"));
  if (!goals) fail("/app/plan", "اكتب أهداف خطتك الفصلية");
  await db.learningPlan.upsert({
    where: { userId: user.id },
    create: { userId: user.id, goals, weeklyPlan, memorization },
    update: { goals, weeklyPlan, memorization },
  });
  revalidatePath("/app");
  ok("/app/plan", "تم حفظ خطة التعلم");
}

export async function addTadabbur(formData: FormData) {
  const user = await participant();
  const week = num(formData.get("week"), -1);
  const topic = str(formData.get("topic"));
  const notes = str(formData.get("notes"));
  if (!topic || week < 0) fail("/app/plan", "اكتب موضوع الوقفة التدبرية والأسبوع");
  await db.tadabburStop.create({ data: { userId: user.id, week, topic, notes: notes || null } });
  ok("/app/plan", "تم تسجيل الوقفة التدبرية");
}

export async function deleteTadabbur(formData: FormData) {
  const user = await participant();
  await db.tadabburStop.deleteMany({ where: { id: str(formData.get("id")), userId: user.id } });
  revalidatePath("/app/plan");
}

// ——— دفتر التأمل ———
export async function addReflection(formData: FormData) {
  const user = await participant();
  const text = str(formData.get("text"));
  if (!text) fail("/app/reflection", "اكتب سطر التأمل");
  await db.reflection.create({ data: { userId: user.id, text } });
  ok("/app/reflection", "تم حفظ التأمل");
}

export async function deleteReflection(formData: FormData) {
  const user = await participant();
  await db.reflection.deleteMany({ where: { id: str(formData.get("id")), userId: user.id } });
  revalidatePath("/app/reflection");
}

// ——— متتبع العادات ———
export async function addHabit(formData: FormData) {
  const user = await participant();
  const name = str(formData.get("name"));
  if (!name) fail("/app/habits", "اكتب اسم العادة");
  const count = await db.habit.count({ where: { userId: user.id } });
  if (count >= 5) fail("/app/habits", "الحد الأقصى خمس عادات");
  await db.habit.create({ data: { userId: user.id, name } });
  ok("/app/habits", "تمت إضافة العادة");
}

export async function toggleHabit(formData: FormData) {
  const user = await participant();
  const habitId = str(formData.get("habitId"));
  const date = str(formData.get("date")) || todayKey();
  const habit = await db.habit.findFirst({ where: { id: habitId, userId: user.id } });
  if (!habit) return;
  const existing = await db.habitLog.findUnique({ where: { habitId_date: { habitId, date } } });
  if (existing) await db.habitLog.delete({ where: { id: existing.id } });
  else await db.habitLog.create({ data: { habitId, date } });
  revalidatePath("/app/habits");
}

export async function deleteHabit(formData: FormData) {
  const user = await participant();
  await db.habit.deleteMany({ where: { id: str(formData.get("id")), userId: user.id } });
  revalidatePath("/app/habits");
}

// ——— الإشعارات ———
export async function markAllRead(formData: FormData) {
  const user = await requireRole("PARTICIPANT", "ADMIN", "MENTOR");
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  const back = str(formData.get("back")) || "/app/notifications";
  revalidatePath(back);
  redirect(back);
}
