import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { todayKey, weekdayIndex } from "@/lib/dates";
import { currentWeekNumber, getWeekByNumber, getWeeks } from "@/lib/weeks";
import { readingTotals, weekQuota } from "@/lib/reading-quota";
import { peekCronSecret, secretMatches } from "@/lib/secrets";
import { cohortWhere, participantsWhere } from "@/lib/cohort";
import { ensureSchema } from "@/lib/setup";

/**
 * نقطة التذكيرات المجدولة. تُستدعى مرة يومياً (مثلاً 07:00 بتوقيت الرياض) من مجدول خارجي:
 *   GET /api/cron/reminders?key=<المفتاح>
 * المفتاح يُولَّد تلقائياً ويُحفظ في قاعدة البيانات، ويستخدمه مشغّل Cron داخلياً.
 * محمية بمفتاح، ومحصّنة ضد التكرار في اليوم نفسه.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  /**
   * الاستيثاق **قبل** الإقلاع. كان الإقلاع يسبقه، فكان أيُّ غريبٍ يطرق هذا
   * الباب يُطلق ترحيلاً وبذراً — إغراقٌ بطلبٍ واحد. فصارت كلفةُ المجهول
   * استعلاماً واحداً مخزَّناً في النسخة، وصفرَ عملٍ في القاعدة.
   */
  if (!(await secretMatches(key, await peekCronSecret()))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // والمجدول لا يمرّ بالجلسة التي تطبّق الترحيلات، فتُضمن هنا قبل لمس جداول قد تكون جديدة
  await ensureSchema();

  const now = new Date();
  const today = todayKey(now);
  const wd = weekdayIndex(now);
  const weekNo = await currentWeekNumber(now);
  const week = await getWeekByNumber(weekNo);
  const sent: string[] = [];

  /**
   * المطالبة **قبل** العمل: إنشاءُ المفتاح هو القفل نفسه، فالقيد `UNIQUE` يردّ
   * الثانية بلا سباق. وكانت العلامة تُكتب بعد العمل، فكان السقوط في منتصف
   * الدفعة يُعيدها كلَّها في الاستدعاء التالي — ويصل ما وصل مرتين.
   */
  const once = async (kind: string, fn: () => Promise<void>) => {
    const k = `reminder:${today}:${kind}`;
    try {
      await db.setting.create({ data: { key: k, value: `claimed at ${Date.now()}` } });
    } catch {
      return; // أُرسل اليوم، أو استدعاءٌ آخر يُرسله الآن
    }
    await fn();
    sent.push(kind);
  };

  const participants = (await db.user.findMany({ where: await participantsWhere(), select: { id: true } })).map((u) => u.id);
  const admins = (await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } })).map((u) => u.id);

  if (week && weekNo >= 0 && weekNo <= 13) {
    if (wd === 6) {
      await once("saturday", async () => {
        await notifyUsers(participants, { title: `اللقاء الحضوري — الأسبوع ${week.label}`, body: week.session, url: `/app/week?week=${weekNo}` });
        await notifyUsers(admins, { title: "اليوم: إدارة اللقاء الحضوري", body: "سجّل الحضور والملاحظات بعد اللقاء.", url: `/admin/attendance?week=${weekNo}` });
      });
    }
    if (wd === 0 && weekNo <= 12) {
      await once("sunday", async () => {
        const q = weekQuota(week);
        await notifyUsers(participants, { title: "ورد هذا الأسبوع والمهمة", body: `الورد: ${week.reading}${q ? ` — ${q.pages} صفحة` : ""}. المهمة: ${week.task}.`, url: "/app/tasks" });
      });
    }
    if (wd === 2 && weekNo <= 13) {
      await once("tuesday", async () => {
        await notifyUsers(participants, { title: "حلقة النقاش عن بُعد الليلة", body: week.circle, url: "/app/quizzes" });
        await notifyUsers(admins, { title: "اليوم: حلقة النقاش والاختبار التكويني", body: "أدر الحلقة وسجّل الحضور عن بُعد.", url: `/admin/attendance?week=${weekNo}` });
      });
    }
    if (wd === 4 && weekNo <= 12) {
      await once("thursday", async () => {
        const done = await db.weeklyReport.findMany({ where: { week: weekNo, userId: { in: participants } }, select: { userId: true } });
        const doneSet = new Set(done.map((d) => d.userId));
        const pending = participants.filter((p) => !doneSet.has(p));
        await notifyUsers(pending, { title: "تسليم التقرير الأسبوعي اليوم", body: "موعد التسليم قبل الساعة العاشرة مساءً.", url: `/app/reports/${weekNo}` });
        await notifyUsers(admins, { title: "اليوم: استلام التقارير الأسبوعية", body: `${pending.length} مشارك لم يسلّم بعد.`, url: `/admin/reports?week=${weekNo}` });
      });
    }
    if (wd === 5) {
      await once("friday", async () => {
        await notifyUsers(participants, { title: "تأمل الجمعة", body: "20 دقيقة تأمل ذاتي وسطر في الدفتر، ثم حدّث خطة التعلم.", url: "/app/reflection" });
        await notifyUsers(admins, { title: "اليوم: تحديث سجل الأداء", body: "راجع سجل الأداء وأعدّ التغذية الراجعة الفردية.", url: "/admin/participants" });
      });
    }
    if (wd >= 0 && wd <= 4 && weekNo <= 12) {
      /**
       * التذكير لمن لم يبلغ وردَ يومه بالصفحات، لا لمن لم يكتب بطاقةً اليوم: من قرأ
       * أسبوعه كلَّه في بطاقة واحدة كان يُذكَّر كل صباحٍ بعدها، ومن قرأ عشراً من نصابٍ
       * يومي اثنتي عشرة صفحة لا يُذكَّر. والمُرجَع من البطاقات لا يُحسب حتى يُعاد.
       */
      await once("reading", async () => {
        const q = weekQuota(week);
        if (!q) return;
        const [weeks, cards, returned] = await Promise.all([
          getWeeks(),
          db.readingCard.findMany({ where: { userId: { in: participants } }, select: { id: true, userId: true, date: true, fromPage: true, toPage: true } }),
          db.itemReturn.findMany({ where: { kind: "READING_CARD", resolvedAt: null, userId: { in: participants } }, select: { recordId: true } }),
        ]);
        const exclude = new Set(returned.map((r) => r.recordId));
        // نصاب ما مضى من الأسابيع، وأيامُ هذا الأسبوع حتى اليوم (الأحد = 0)
        const expected = (cs: typeof cards) => readingTotals(cs, weeks, now, exclude).requiredSoFar + q.daily * (wd + 1);
        const behind = participants.filter((p) => {
          const mine = cards.filter((c) => c.userId === p);
          return readingTotals(mine, weeks, now, exclude).read < expected(mine);
        });
        await notifyUsers(behind, { title: "الورد القرائي اليوم", body: `نصاب اليوم نحو ${Math.round(q.daily)} صفحة — سجّلها في بطاقتك مع أهم فائدة.`, url: "/app/reading" });
      });
    }
  }

  // مهام يحين موعدها خلال 24 ساعة
  // ومن مُدّد له موعدٌ أبعد لا يُذكَّر بموعدٍ ليس موعده، ومن أُرجع إليه تسليمه يُذكَّر كمن لم يسلّم
  await once("due-soon", async () => {
    const until = new Date(now.getTime() + 24 * 3600 * 1000);
    const soon = await db.assignment.findMany({ where: { dueAt: { gte: now, lte: until }, ...(await cohortWhere()) }, include: { submissions: { select: { id: true, userId: true } } } });
    if (!soon.length) return;
    const [extensions, returned] = await Promise.all([
      db.excuseRequest.findMany({ where: { kind: "EXTENSION", status: "APPROVED", assignmentId: { in: soon.map((a) => a.id) }, untilAt: { gt: until } }, select: { userId: true, assignmentId: true } }),
      db.itemReturn.findMany({ where: { kind: "SUBMISSION", resolvedAt: null, recordId: { in: soon.flatMap((a) => a.submissions.map((s) => s.id)) } }, select: { recordId: true } }),
    ]);
    const reopened = new Set(returned.map((r) => r.recordId));
    for (const a of soon) {
      const done = new Set(a.submissions.filter((s) => !reopened.has(s.id)).map((s) => s.userId));
      const later = new Set(extensions.filter((e) => e.assignmentId === a.id).map((e) => e.userId));
      await notifyUsers(participants.filter((p) => !done.has(p) && !later.has(p)), { title: "مهمة يحين موعدها غداً", body: a.title, url: `/app/tasks/${a.id}` });
    }
  });

  return NextResponse.json({ ok: true, today, weekday: wd, week: weekNo, sent });
}
