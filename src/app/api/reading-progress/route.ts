import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isPreview } from "@/lib/auth";
import { authorizeAttachment } from "@/lib/attachments";

/**
 * حفظُ موضع القراءة في ملف: `{ id, page, pages }`.
 *
 * مُعالِجُ مسارٍ لا إجراءَ خادم، لأن إجراء الخادم يُعيد التوجيه ويُعيد تصيير
 * الصفحة — والعارضُ يحفظ وهو مفتوح، فإعادةُ التصيير تقذف القارئ من موضعه.
 * وعلى شكل `‎/api/push/subscribe`: جلسةٌ ثم 401 بصيغة JSON، وتحقّقٌ يردّ 400،
 * وردٌّ لا يُبطل تخزيناً ولا يُعيد تصييراً — فالعميل يملك حالته.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; page?: unknown; pages?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const page = Number(body.page);
  const pages = Number(body.pages);
  if (!id || !Number.isInteger(page) || !Number.isInteger(pages) || page < 1 || pages < 1 || page > pages) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  /**
   * الإذنُ يُعاد فحصه بالسلّم نفسه الذي يحرس عرض الملف: بدونه يكتب أيُّ مسجَّلٍ
   * صفوفاً لمرفقاتٍ لا يملك قراءتها — ويستدلّ بقبول الطلب على وجود الملف.
   */
  const auth = await authorizeAttachment({ id });
  if (auth.status !== 200) return NextResponse.json({ error: "غير مصرح" }, { status: auth.status });

  // مديرٌ يعاين تجربة المشارك يقرأ ولا يكتب. وليس خطأً يُعرض له، فالقراءة مباحة
  if (auth.user.role === "ADMIN" && (await isPreview())) return NextResponse.json({ ok: true, saved: false });

  await db.readingProgress.upsert({
    where: { userId_attachmentId: { userId: auth.user.id, attachmentId: id } },
    create: { userId: auth.user.id, attachmentId: id, page, pages },
    update: { page, pages },
  });
  return NextResponse.json({ ok: true, saved: true });
}
