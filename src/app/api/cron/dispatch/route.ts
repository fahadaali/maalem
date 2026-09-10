import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { getCronSecret } from "@/lib/secrets";

/**
 * إرسال التذكيرات المخصصة التي حان موعدها. تُستدعى كل ساعة:
 *   GET /api/cron/dispatch?key=<المفتاح>
 * كل تذكير يُرسل مرة واحدة، ويُختم بوقت إرساله فلا يتكرر.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!key || key !== (await getCronSecret())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const due = await db.reminder.findMany({ where: { sentAt: null, sendAt: { lte: now } }, orderBy: { sendAt: "asc" }, take: 20 });
  const results: { id: string; recipients: number }[] = [];

  for (const r of due) {
    const cohortScope = r.cohortId ? { cohortId: r.cohortId } : {};
    let ids: string[] = [];
    if (r.audience === "ONE" && r.userId) {
      ids = [r.userId];
    } else if (r.audience === "ADMINS") {
      ids = (await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } })).map((u) => u.id);
    } else if (r.audience === "MENTORS") {
      ids = (await db.user.findMany({ where: { role: "MENTOR", active: true, ...cohortScope }, select: { id: true } })).map((u) => u.id);
    } else if (r.audience === "ALL") {
      const inCohort = await db.user.findMany({ where: { active: true, ...cohortScope }, select: { id: true } });
      const admins = await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
      ids = [...new Set([...inCohort, ...admins].map((u) => u.id))];
    } else {
      ids = (await db.user.findMany({ where: { role: "PARTICIPANT", active: true, ...cohortScope }, select: { id: true } })).map((u) => u.id);
    }

    await notifyUsers(ids, { title: r.title, body: r.body, url: r.url ?? undefined }, { email: r.channels === "PUSH_EMAIL" ? "always" : "fallback" });
    await db.reminder.update({ where: { id: r.id }, data: { sentAt: new Date() } });
    results.push({ id: r.id, recipients: ids.length });
  }

  return NextResponse.json({ ok: true, dispatched: results.length, results });
}
