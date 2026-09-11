import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dispatchReminder } from "@/lib/reminders";
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
    const res = await dispatchReminder(r);
    results.push({ id: r.id, recipients: res.inApp });
  }

  return NextResponse.json({ ok: true, dispatched: results.length, results });
}
