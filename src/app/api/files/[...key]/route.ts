import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isPreview } from "@/lib/auth";
import { deleteObject, getObject } from "@/lib/storage";
import { authorizeAttachment } from "@/lib/attachments";

const authorize = (keyParts: string[]) => authorizeAttachment({ key: keyParts.join("/") });

export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const auth = await authorize(key);
  if (auth.status !== 200) return NextResponse.json({ error: "غير مصرح" }, { status: auth.status });
  /**
   * مُصادِقٌ للتخزين المؤقّت، قيمتُه مفتاحُ التخزين: `safeKey` يولّده مرةً بـuuid
   * ولا يُعاد استعماله، فالبايتات عند المفتاح لا تتبدّل أبداً.
   *
   * وكان الردّ `max-age=0` **بلا مُصادِقٍ أصلاً**، فلا شيء يُراجَع به — فكلُّ
   * فتحةٍ تُنزّل الملف كاملاً. وكتابٌ من عشرات الميغابايتات يُقرأ على أيامٍ
   * يُنزَّل في كل مرة، ويُهدر بذلك استئنافُ القراءة من موضعها.
   *
   * والإذنُ مفحوصٌ **قبل** هذا السطر في كل طلب: من زال إذنه يُردّ ولا تنفعه
   * نسخته المخزَّنة، فالمراجعةُ لا تُغني عن الحراسة.
   */
  const etag = `"${auth.att.key}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, max-age=0, must-revalidate" } });
  }
  const obj = await getObject(auth.att.key);
  if (!obj) return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  const filename = encodeURIComponent(auth.att.name);
  // ‏?download=1 يجعل المتصفح يحفظ الملف بدل عرضه — زرّ التنزيل في العارض وصفّ المرفق
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(obj.body as BodyInit, {
    headers: {
      "Content-Type": obj.contentType ?? auth.att.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${filename}`,
      ETag: etag,
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      ...(obj.size ? { "Content-Length": String(obj.size) } : {}),
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const auth = await authorize(key);
  if (auth.status !== 200) return NextResponse.json({ error: "غير مصرح" }, { status: auth.status });
  if (auth.user.role !== "ADMIN" && auth.att.userId !== auth.user.id) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  if (auth.user.role === "ADMIN" && (await isPreview())) return NextResponse.json({ error: "وضع المعاينة للقراءة فقط" }, { status: 403 });
  await deleteObject(auth.att.key);
  await db.attachment.delete({ where: { id: auth.att.id } });
  // ومواضعُ القراءة فيه: صريحاً لا بمفتاحٍ أجنبيّ، فإنفاذُه على D1 غيرُ مضمون
  await db.readingProgress.deleteMany({ where: { attachmentId: auth.att.id } });
  return NextResponse.json({ ok: true });
}
