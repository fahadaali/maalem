import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, isPreview } from "@/lib/auth";
import { ALLOWED_TYPES, MAX_FILE_BYTES, putObject, safeKey } from "@/lib/storage";
import { toItem } from "@/lib/attachments";

const KINDS = new Set(["SUBMISSION", "PROJECT", "FIELD", "REPORT", "MATERIAL", "WEEKCARD", "OTHER"]);

/** أنواع يرفعها مدير المشروع وحده، ويقرؤها كل من دخل المنصة */
const ADMIN_KINDS = new Set(["MATERIAL", "WEEKCARD"]);

/**
 * السجل المُرفَق إليه يجب أن يكون لصاحب الرفع: معرّفات السجلات لا تُخمَّن، لكن
 * من وصل إلى معرّف سجل غيره كان يستطيع إلحاق ملف به فيظهر شاهداً في ملف ذلك المشارك.
 */
async function ownsRef(userId: string, role: string, kind: string, refId: string | null): Promise<boolean> {
  if (role === "ADMIN") return true;
  switch (kind) {
    case "SUBMISSION":
      // المرجع هو المهمة، والتسليم يخصّ الرافع نفسه
      return !!refId && !!(await db.assignment.findUnique({ where: { id: refId }, select: { id: true } }));
    case "FIELD":
      return !!refId && !!(await db.fieldLog.findFirst({ where: { id: refId, userId }, select: { id: true } }));
    case "REPORT":
      return !!refId && !!(await db.weeklyReport.findFirst({ where: { id: refId, userId }, select: { id: true } }));
    case "PROJECT":
      return !refId || !!(await db.graduationProject.findFirst({ where: { id: refId, userId }, select: { id: true } }));
    default:
      return !refId;
  }
}

/** رفع مرفق: multipart/form-data يحوي file و kind و refId (اختياري) */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role === "ADMIN" && (await isPreview())) return NextResponse.json({ error: "وضع المعاينة للقراءة فقط" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "OTHER");
  const refId = form.get("refId") ? String(form.get("refId")) : null;
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "لم يُرفق ملف" }, { status: 400 });
  if (!KINDS.has(kind)) return NextResponse.json({ error: "نوع غير صحيح" }, { status: 400 });
  if (ADMIN_KINDS.has(kind) && user.role !== "ADMIN") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  if (!(await ownsRef(user.id, user.role, kind, refId))) return NextResponse.json({ error: "السجل المقصود غير موجود أو ليس لك" }, { status: 403 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "حجم الملف يتجاوز 25 ميغابايت" }, { status: 413 });
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) return NextResponse.json({ error: "نوع الملف غير مسموح" }, { status: 415 });

  const key = safeKey(user.id, file.name);
  await putObject(key, await file.arrayBuffer(), contentType);
  const att = await db.attachment.create({ data: { userId: user.id, kind, refId, key, name: file.name.slice(0, 200), size: file.size, contentType } });
  return NextResponse.json(toItem(att));
}
