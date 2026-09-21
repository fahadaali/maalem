import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSecret } from "@/lib/secrets";
import { commitUpload } from "@/lib/upload-server";
import { verifyTicket } from "@/lib/upload-ticket";

/**
 * الخطوة الأخيرة: بعد أن استقرّت بايتات الملف في التخزين يُنشأ صفُّ المرفق هنا.
 *
 * ويناديه غلافُ العامل نفسه بعد الرفع — بجسمٍ صغير — فيبقى إنشاء الصفوف
 * بـPrisma في موضعه الواحد، ولا تُكتب في الغلاف نسخةُ SQL ثانية تتخلّف عن المخطط.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { ticket?: unknown } | null;
  const ticket = await verifyTicket(await getAuthSecret(), String(body?.ticket ?? ""));
  if (!ticket) return NextResponse.json({ error: "تذكرة الرفع غير صالحة أو انتهت. أعد المحاولة." }, { status: 401 });
  // والجلسة أيضاً: التذكرة تشهد بما أُذن فيه، والكعكةُ تشهد بأن صاحبها هو الطالب
  const user = await getSession();
  if (!user || user.id !== ticket.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await commitUpload(ticket));
}
