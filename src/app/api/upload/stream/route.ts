import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSecret } from "@/lib/secrets";
import { putObject } from "@/lib/storage";
import { commitUpload } from "@/lib/upload-server";
import { verifyTicket } from "@/lib/upload-ticket";

/**
 * بديلُ التطوير المحلي وحده.
 *
 * على Cloudflare لا يبلغ هذا المسارُ Next أصلاً: غلافُ العامل يعترضه في
 * `src/worker.ts` ويمرّر البايتات تيّاراً إلى R2 بلا تجميع — وذاك هو الرفع
 * الحقيقي. و`next dev` يعمل بلا غلاف، فلولا هذا البديل لانقطع الرفع في
 * التطوير. والتجميع هنا لا يضرّ: لا حدَّ ذاكرةٍ في Node.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const ticket = await verifyTicket(await getAuthSecret(), url.searchParams.get("ticket") ?? "");
  if (!ticket) return NextResponse.json({ error: "تذكرة الرفع غير صالحة أو انتهت. أعد المحاولة." }, { status: 401 });
  const user = await getSession();
  if (!user || user.id !== ticket.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const blob = await req.blob();
  // الحجمُ من التذكرة: هي وحدها التي مرّت على الحدّ والتحقق
  if (blob.size !== ticket.size) return NextResponse.json({ error: "حجم الملف لا يطابق تذكرة الرفع." }, { status: 400 });
  await putObject(ticket.key, blob, ticket.contentType);
  return NextResponse.json(await commitUpload(ticket));
}
