import { NextResponse } from "next/server";
import { drainNotifications } from "@/lib/notify";
import { peekCronSecret, secretMatches } from "@/lib/secrets";
import { ensureSchema } from "@/lib/setup";

/**
 * تصريفُ طابور الإشعارات. تُستدعى كل عشر دقائق:
 *   GET /api/cron/drain?key=<المفتاح>
 *
 * وجدولٌ مستقلٌّ عن التذكيرات عمداً: لكل استدعاءٍ مجدولٍ ميزانيتُه الخمسون من
 * الطلبات الفرعية، فتشعُّبُ التسليم لا يزاحم عملَ التذكيرات ولا طلبات المستخدمين.
 * وما تجاوز ميزانيةَ التصريفة يبقى في الطابور للتصريفة التالية، لا يضيع.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  // الاستيثاق قبل الإقلاع: طلبٌ مجهول لا يُطلق ترحيلاً ولا بذراً ولا يكتب سرّاً
  if (!(await secretMatches(key, await peekCronSecret()))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureSchema();

  const r = await drainNotifications();
  return NextResponse.json({ ok: true, ...r });
}
