import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { currentWeekNumber, getWeek, todayKey, weekdayIndex } from "@/lib/dates";

/**
 * نقطة التذكيرات المجدولة. تُستدعى مرة يومياً (مثلاً 07:00 بتوقيت الرياض) من مجدول خارجي:
 *   GET /api/cron/reminders?key=CRON_SECRET
 * محمية بمفتاح، ومحصّنة ضد التكرار في اليوم نفسه.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const today = todayKey(now);
  const wd = weekdayIndex(now);
  const weekNo = currentWeekNumber(now);
  const week = getWeek(weekNo);
  const sent: string[] = [];

  const once = async (kind: string, fn: () => Promise<void>) => {
    const k = `reminder:${today}:${kind}`;
    const exists = await db.setting.findUnique({ where: { key: k } });
    if (exists) return;
    await fn();
    await db.setting.create({ data: { key: k, value: new Date().toISOString() } });
    sent.push(kind);
  };

  const participants = (await db.user.findMany({ where: { role: "PARTICIPANT", active: true }, select: { id: true } })).map((u) => u.id);
  const admins = (await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } })).map((u) => u.id);

  if (week && weekNo >= 0 && weekNo <= 13) {
    if (wd === 6) {
      await once("saturday", async () => {
        await notifyUsers(participants, { title: `اللقاء الحضوري — الأسبوع ${week.label}`, body: week.session, url: "/program/schedule" });
        await notifyUsers(admins, { title: "اليوم: إدارة اللقاء الحضوري", body: "سجّل الحضور والملاحظات بعد اللقاء.", url: `/admin/attendance?week=${weekNo}` });
      });
    }
    if (wd === 0 && weekNo <= 12) {
      await once("sunday", async () => {
        await notifyUsers(participants, { title: "ورد هذا الأسبوع والمهمة", body: `الورد: ${week.reading}. المهمة: ${week.task}.`, url: "/app/reading" });
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
        const done = await db.weeklyReport.findMany({ where: { week: weekNo }, select: { userId: true } });
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
      await once("reading", async () => {
        const start = new Date(`${today}T00:00:00+03:00`);
        const end = new Date(`${today}T23:59:59+03:00`);
        const cards = await db.readingCard.findMany({ where: { date: { gte: start, lte: end } }, select: { userId: true } });
        const has = new Set(cards.map((c) => c.userId));
        await notifyUsers(participants.filter((p) => !has.has(p)), { title: "بطاقة القراءة اليومية", body: "10 صفحات اليوم — سجّل أهم فائدة وسؤالك للحلقة.", url: "/app/reading" });
      });
    }
  }

  // مهام يحين موعدها خلال 24 ساعة
  await once("due-soon", async () => {
    const soon = await db.assignment.findMany({ where: { dueAt: { gte: now, lte: new Date(now.getTime() + 24 * 3600 * 1000) } }, include: { submissions: { select: { userId: true } } } });
    for (const a of soon) {
      const done = new Set(a.submissions.map((s) => s.userId));
      await notifyUsers(participants.filter((p) => !done.has(p)), { title: "مهمة يحين موعدها غداً", body: a.title, url: `/app/tasks/${a.id}` });
    }
  });

  return NextResponse.json({ ok: true, today, weekday: wd, week: weekNo, sent });
}
