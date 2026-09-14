import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, isPreview } from "@/lib/auth";
import { deleteObject, getObject } from "@/lib/storage";

async function authorize(keyParts: string[]) {
  const user = await getSession();
  if (!user) return { status: 401 as const };
  const key = keyParts.join("/");
  const att = await db.attachment.findUnique({ where: { key } });
  if (!att) return { status: 404 as const };
  let allowed = user.role === "ADMIN" || att.userId === user.id;
  if (!allowed && user.role === "MENTOR") {
    const owner = await db.user.findUnique({ where: { id: att.userId }, select: { mentorId: true } });
    allowed = owner?.mentorId === user.id;
  }
  // مواد المكتبة وبطاقات الأسابيع محتوى برنامج لا شواهد مشارك، فتُتاح لكل من دخل المنصة
  if (!allowed) allowed = att.kind === "MATERIAL" || att.kind === "WEEKCARD";
  // ما عدا ذلك — ملفات المشاريع والشواهد — لصاحبها ومشرفه ومدير المشروع وحدهم
  return allowed ? { status: 200 as const, att, user } : { status: 403 as const };
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const auth = await authorize(key);
  if (auth.status !== 200) return NextResponse.json({ error: "غير مصرح" }, { status: auth.status });
  const obj = await getObject(auth.att.key);
  if (!obj) return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  const filename = encodeURIComponent(auth.att.name);
  return new Response(obj.body as BodyInit, {
    headers: {
      "Content-Type": obj.contentType ?? auth.att.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, max-age=0",
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
  return NextResponse.json({ ok: true });
}
