"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyNow, notifyUsers } from "@/lib/notify";
import { fail, ok, safeBack } from "@/lib/redirects";
import { formatDateTime, keyToDate } from "@/lib/dates";
import { num, str } from "@/lib/utils";
import { isReturnKind, RETURN_KINDS, type ReturnKind } from "@/lib/returns";
import { closeReturns, fileHref, findOpenReturn, itemOwner } from "@/lib/items";
import { loadParticipant, loadProgram } from "@/lib/participant-data";
import { originalDue, daysLate, overdueLabel } from "@/lib/obligations";

/**
 * إجراءات مدير المشروع على إدخالات المشارك من ملفه: الإرجاع للتعديل، وإلغاؤه،
 * والتعديل، والمراجعة بملاحظة. والحذف يمرّ بمركز الأنشطة (`undoActivity`)
 * بلقطةٍ تُعاد منها، فلا يضيع إدخالٌ بنقرة.
 */

const admin = () => requireRole("ADMIN");

/** يعود إلى ملف المشارك عند العنصر نفسه، أو إلى الوجهة المرسلة إن كانت داخل المنصة */
function backTo(formData: FormData, userId: string, kind: ReturnKind, id: string): string {
  return safeBack(str(formData.get("back")), fileHref(userId, kind, id));
}

function readKind(formData: FormData): ReturnKind {
  const kind = str(formData.get("kind"));
  if (!isReturnKind(kind)) fail("/admin/participants", "نوع إدخال غير معروف");
  return kind;
}

/** يُحدّث ما يقرأ هذا الإدخال: ملف صاحبه، وواجهته هو بعدّادها */
function refresh(userId: string) {
  revalidatePath(`/admin/participants/${userId}`);
  revalidatePath("/admin/participants");
  revalidatePath("/admin/reading");
  revalidatePath("/app", "layout");
}

/**
 * إرجاع إدخالٍ إلى صاحبه ليعدّله ويعيده. يبقى السجل كما هو بأختام مراجعته، ويُفتح
 * لصاحبه، ولا يُحتسب في درجته حتى يُعيده؛ ويظهر في «مهامي» بعدّاد موعده الأصلي
 * لا بمهلة جديدة — ويُشعَر في الحال لا مع المُصرِّف بعد دقائق.
 */
export async function returnItem(formData: FormData) {
  const me = await admin();
  const kind = readKind(formData);
  const id = str(formData.get("id"));
  const note = str(formData.get("note"));
  const owner = await itemOwner(kind, id);
  if (!owner) fail("/admin/participants", "الإدخال غير موجود");
  const back = backTo(formData, owner.userId, kind, id);
  if (!note) fail(back, "اكتب للمشارك ما المطلوب تعديله");
  if (owner.unreturnable) fail(back, owner.unreturnable);
  // إرجاعٌ واحد مفتوح للسجل: الفهرس لا يمنع التكرار، وصفّان مفتوحان يُربكان العدّاد
  if (await findOpenReturn(kind, id)) fail(back, "هذا الإدخال مُرجَع إلى صاحبه من قبل، ولم يُعده بعد");

  await db.itemReturn.create({ data: { kind, recordId: id, userId: owner.userId, note, returnedBy: me.name } });

  const [rows, program] = await Promise.all([loadParticipant(owner.userId), loadProgram()]);
  const due = rows ? originalDue(kind, owner.due, rows, program.weeks) : null;
  const now = new Date();
  const when = due ? (due < now ? ` — ${overdueLabel(daysLate(due, now))} عن موعده الأصلي (${formatDateTime(due)})` : ` — موعده ${formatDateTime(due)}`) : "";
  const sent = await notifyNow(owner.userId, {
    title: `أُرجع إليك للتعديل: ${owner.title}`,
    body: `${note.slice(0, 140)}${when}`,
    url: owner.href,
  });
  refresh(owner.userId);
  ok(back, sent.pushed || sent.emailed ? "أُرجع إلى صاحبه ووصله الإشعار الآن" : "أُرجع إلى صاحبه، وإشعاره في صندوقه داخل المنصة");
}

/** إلغاء إرجاعٍ لم يُعِده صاحبه بعد: يُغلق فحسب، فلا يُعاد ختمٌ قد يكون تغيّر بعده */
export async function cancelReturn(formData: FormData) {
  await admin();
  const kind = readKind(formData);
  const id = str(formData.get("id"));
  const owner = await itemOwner(kind, id);
  if (!owner) fail("/admin/participants", "الإدخال غير موجود");
  const back = backTo(formData, owner.userId, kind, id);
  // صفحةٌ قديمة بعد أن أعاده صاحبه، أو نقرةٌ ثانية: لا إشعار عن إرجاعٍ لم يعد قائماً
  if (!(await closeReturns(kind, [id], "CANCELLED"))) {
    refresh(owner.userId);
    fail(back, "لا إرجاع مفتوح على هذا الإدخال — لعلّ صاحبه أعاده");
  }
  await notifyUsers([owner.userId], { title: "أُلغي إرجاعٌ يخصّك", body: `${owner.title}: لم يعد مطلوباً تعديله.`, url: owner.href });
  refresh(owner.userId);
  ok(back, "أُلغي الإرجاع");
}

/** الحقول المرسلة لنوعٍ بعينه بعد التحقق، جاهزةً للكتابة */
function parseEdit(kind: ReturnKind, f: FormData, back: string): Record<string, unknown> {
  const text = (n: string) => str(f.get(n));
  const opt = (n: string) => text(n) || null;
  const url = (n: string) => {
    const v = text(n);
    if (v && !/^https?:\/\//i.test(v)) fail(back, "الروابط يجب أن تبدأ بـ http أو https");
    return v || null;
  };
  const date = (n: string) => {
    const v = text(n);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(keyToDate(v).getTime())) fail(back, "تاريخ غير صحيح");
    return keyToDate(v);
  };
  switch (kind) {
    case "READING_CARD": {
      const fromPage = num(f.get("fromPage"));
      const toPage = num(f.get("toPage"));
      if (!text("book") || !text("benefit")) fail(back, "الكتاب وأهم فائدة حقلان إلزاميان");
      if (fromPage < 1 || toPage < fromPage) fail(back, "أرقام الصفحات: تبدأ من 1 ولا تقل الأخيرة عن الأولى");
      return { date: date("date"), book: text("book"), fromPage, toPage, benefit: text("benefit"), question: opt("question") };
    }
    case "WEEKLY_REPORT":
      // العمودان الأولان غير فارغين في القاعدة: يُكتب فيهما فراغ لا null
      return { reading: text("reading"), benefits: text("benefits"), fieldNote: opt("fieldNote"), quizResult: opt("quizResult"), application: opt("application"), difficulty: opt("difficulty") };
    case "SUBMISSION":
      if (!text("content")) fail(back, "وصف ما أنجزه حقل إلزامي");
      return { content: text("content"), link: url("link") };
    case "LEARNING_PLAN":
      if (!text("goals")) fail(back, "أهداف الخطة حقل إلزامي");
      return { goals: text("goals"), weeklyPlan: text("weeklyPlan"), memorization: text("memorization") };
    case "FIELD_LOG": {
      const hours = num(f.get("hours"));
      if (hours <= 0 || hours > 12) fail(back, "أدخل عدد ساعات صحيحاً");
      if (!text("mentorName") || !text("note")) fail(back, "المشرف والملاحظة حقلان إلزاميان");
      return { date: date("date"), hours, mentorName: text("mentorName"), note: text("note") };
    }
    case "LEADERSHIP":
      if (!text("title")) fail(back, "عنوان النشاط حقل إلزامي");
      return { title: text("title"), date: date("date"), report: opt("report") };
    case "PROJECT":
      if (!text("topic")) fail(back, "الموضوع حقل إلزامي");
      return { topic: text("topic"), problem: opt("problem"), draftLink: url("draftLink"), finalLink: url("finalLink") };
  }
}

/**
 * تعديل مدير المشروع لإدخال مشارك. يُكتب السجل كما هو بلا مساس بأختام مراجعته،
 * ويُشعَر صاحبه إن اختار المدير ذلك (مختارٌ افتراضياً) — فلا يتبدّل ما كتبه في
 * غيبته بلا علمه. والمرفقات لا تُرفع من هنا: الملف يُنسب إلى رافعه فلا يراه صاحب
 * الإدخال.
 */
export async function editItem(formData: FormData) {
  await admin();
  const kind = readKind(formData);
  const id = str(formData.get("id"));
  const owner = await itemOwner(kind, id);
  if (!owner) fail("/admin/participants", "الإدخال غير موجود");
  const back = backTo(formData, owner.userId, kind, id);
  const data = parseEdit(kind, formData, back);
  switch (kind) {
    case "READING_CARD": {
      // بطاقةٌ واحدة لكل يوم، كما يُلزَم بها صاحبها
      const clash = await db.readingCard.findFirst({ where: { userId: owner.userId, date: data.date as Date, NOT: { id } }, select: { id: true } });
      if (clash) fail(back, "لصاحبها بطاقةٌ أخرى في هذا اليوم");
      await db.readingCard.update({ where: { id }, data });
      break;
    }
    case "WEEKLY_REPORT":
      await db.weeklyReport.update({ where: { id }, data });
      break;
    case "SUBMISSION":
      await db.submission.update({ where: { id }, data });
      break;
    case "LEARNING_PLAN":
      await db.learningPlan.update({ where: { id }, data });
      break;
    case "FIELD_LOG":
      await db.fieldLog.update({ where: { id }, data });
      break;
    case "LEADERSHIP":
      await db.leadershipActivity.update({ where: { id }, data });
      break;
    case "PROJECT":
      await db.graduationProject.update({ where: { id }, data });
      break;
  }
  if (formData.get("notify")) {
    await notifyUsers([owner.userId], { title: `عدّل مدير المشروع ${owner.title}`, body: "اطّلع على التعديل في صفحته.", url: owner.href });
  }
  refresh(owner.userId);
  ok(back, `حُفظ تعديل ${RETURN_KINDS[kind]}`);
}

/**
 * مراجعة بطاقة القراءة أو خطة التعلم: ملاحظةٌ وختم مراجعة، بلا درجة. وإن كتب المدير
 * ملاحظة وصلت صاحبها. والبطاقة المراجَعة تُقفل على صاحبها إلا أن تُرجَع إليه.
 */
export async function reviewItem(formData: FormData) {
  await admin();
  const kind = readKind(formData);
  const id = str(formData.get("id"));
  if (kind !== "READING_CARD" && kind !== "LEARNING_PLAN") fail("/admin/participants", "هذا النوع يُراجَع من صفحته");
  const owner = await itemOwner(kind, id);
  if (!owner) fail("/admin/participants", "الإدخال غير موجود");
  const back = backTo(formData, owner.userId, kind, id);
  // المُرجَع ينتظر صاحبه: اعتمادُه الآن يُبقي الإرجاع مفتوحاً على عنصرٍ معتمد
  if (await findOpenReturn(kind, id)) fail(back, "هذا الإدخال مُرجَع لصاحبه — يُراجَع بعد أن يعيده، أو ألغِ الإرجاع أولاً");
  const feedback = str(formData.get("feedback")) || null;
  const data = { feedback, reviewedAt: new Date() };
  if (kind === "READING_CARD") await db.readingCard.update({ where: { id }, data });
  else {
    // «آخر تحديث» للخطة تحديثُ صاحبها لا مراجعة المدير: يُثبَّت فلا يرفعه `@updatedAt`
    const plan = await db.learningPlan.findUnique({ where: { id }, select: { updatedAt: true } });
    await db.learningPlan.update({ where: { id }, data: { ...data, updatedAt: plan?.updatedAt } });
  }
  if (feedback) await notifyUsers([owner.userId], { title: `ملاحظة مدير المشروع على ${owner.title}`, body: feedback.slice(0, 140), url: kind === "READING_CARD" ? `/app/reading#card-${id}` : "/app/plan" });
  refresh(owner.userId);
  ok(back, "حُفظت المراجعة");
}

/** اعتماد بطاقاتٍ معروضة دفعةً واحدة — لروتين المدير «تدقيق بطاقات القراءة» كل خميس */
export async function reviewCards(formData: FormData) {
  await admin();
  const ids = formData.getAll("ids").map((v) => str(v)).filter(Boolean);
  const back = safeBack(str(formData.get("back")), "/admin/reading");
  if (ids.length === 0) fail(back, "لا بطاقات محددة");
  // المُرجَعة لا تُعتمد من هنا: تنتظر أن يعيدها صاحبها
  const open = await db.itemReturn.findMany({ where: { kind: "READING_CARD", recordId: { in: ids }, resolvedAt: null }, select: { recordId: true } });
  const skip = new Set(open.map((r) => r.recordId));
  const { count } = await db.readingCard.updateMany({ where: { id: { in: ids.filter((i) => !skip.has(i)) }, reviewedAt: null }, data: { reviewedAt: new Date() } });
  revalidatePath("/admin/reading");
  ok(back, `اعتُمدت ${count} بطاقة`);
}
