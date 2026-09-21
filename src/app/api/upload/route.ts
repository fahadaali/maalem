import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { putObject } from "@/lib/storage";
import { toItem } from "@/lib/attachments";
import { authorizeUpload } from "@/lib/upload-server";

/**
 * الرفعُ المجمَّع القديم: multipart/form-data يحوي file و kind و refId (اختياري).
 *
 * ولم يعد طريقَ الواجهة: محوّلُ OpenNext يقرأ الجسم كاملاً في الذاكرة قبل أن
 * يبلغ هذا المعالج، ثم `formData()` تفكّه فتصير نسختين — فيسقط الكبيرُ بـ1102.
 * فصارت الواجهة ترفع على خطوتين (‎/api/upload/ticket ثم ‎/api/upload/stream)
 * تمرّ فيهما البايتات تيّاراً إلى R2 قبل Next.
 *
 * ويبقى هذا قائماً للصغار ولنسخةٍ قديمة من التطبيق المثبَّت لم تُحدَّث بعد:
 * حذفُه اليوم يكسر رفعَ من لم يُحدِّث، والحكمُ فيه هو الحكمُ نفسه لا نسخةٌ
 * ثانية منه.
 */
export async function POST(req: Request) {
  // الاستيثاق قبل العمل: مجهولٌ لا يُفكَّك جسمُه ولا يُقرأ ملفُّه
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "OTHER");
  const refId = form.get("refId") ? String(form.get("refId")) : null;
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "لم يُرفق ملف" }, { status: 400 });
  const contentType = file.type || "application/octet-stream";

  const verdict = await authorizeUpload({ name: file.name, size: file.size, contentType, kind, refId });
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  // يُمرَّر الملفُ نفسه — `File` هو `Blob` — فلا تُصنع نسخةٌ ثالثة منه في الذاكرة
  await putObject(verdict.key, file, contentType);
  const att = await db.attachment.create({
    data: { userId: verdict.user.id, kind, refId, key: verdict.key, name: file.name.slice(0, 200), size: file.size, contentType },
  });
  return NextResponse.json(toItem(att));
}
