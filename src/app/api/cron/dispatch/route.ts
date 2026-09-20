import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dispatchReminder } from "@/lib/reminders";
import { peekCronSecret, secretMatches } from "@/lib/secrets";
import { ensureSchema } from "@/lib/setup";

/**
 * إرسال التذكيرات المخصصة التي حان موعدها. تُستدعى كل ساعة:
 *   GET /api/cron/dispatch?key=<المفتاح>
 * كل تذكير يُرسل مرة واحدة، ويُختم بوقت إرساله فلا يتكرر.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  // الاستيثاق قبل الإقلاع: طلبٌ مجهول لا يُطلق ترحيلاً ولا بذراً ولا يكتب سرّاً
  if (!(await secretMatches(key, await peekCronSecret()))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // والمجدول لا يمرّ بالجلسة التي تطبّق الترحيلات، فتُضمن هنا قبل لمس جداول قد تكون جديدة
  await ensureSchema();

  const now = new Date();
  const due = await db.reminder.findMany({ where: { sentAt: null, sendAt: { lte: now } }, orderBy: { sendAt: "asc" }, take: 20 });
  const results: { id: string; recipients: number }[] = [];

  for (const r of due) {
    const res = await dispatchReminder(r);
    results.push({ id: r.id, recipients: res.queued });
  }

  return NextResponse.json({ ok: true, dispatched: results.length, results });
}
