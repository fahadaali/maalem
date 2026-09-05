import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ALLOWED_TYPES, MAX_FILE_BYTES, putObject, safeKey } from "@/lib/storage";

const KINDS = new Set(["SUBMISSION", "PROJECT", "FIELD", "REPORT", "OTHER"]);

/** رفع مرفق: multipart/form-data يحوي file و kind و refId (اختياري) */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "OTHER");
  const refId = form.get("refId") ? String(form.get("refId")) : null;
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "لم يُرفق ملف" }, { status: 400 });
  if (!KINDS.has(kind)) return NextResponse.json({ error: "نوع غير صحيح" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "حجم الملف يتجاوز 25 ميغابايت" }, { status: 413 });
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) return NextResponse.json({ error: "نوع الملف غير مسموح" }, { status: 415 });

  const key = safeKey(user.id, file.name);
  await putObject(key, await file.arrayBuffer(), contentType);
  const att = await db.attachment.create({ data: { userId: user.id, kind, refId, key, name: file.name.slice(0, 200), size: file.size, contentType } });
  return NextResponse.json({ id: att.id, name: att.name, size: att.size, url: `/api/files/${att.key}` });
}
