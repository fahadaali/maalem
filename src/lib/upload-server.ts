import { db } from "./db";
import { getSession, isPreview, type SessionUser } from "./auth";
import { ALLOWED_TYPES, MAX_FILE_BYTES, safeKey } from "./storage";
import { fileSize } from "./files";
import { toItem } from "./attachments";
import type { AttachmentItem } from "@/components/Attachments";
import type { UploadTicket } from "./upload-ticket";

/**
 * حكمُ الرفع وختمُه: موضعٌ واحد يستعمله مسارُ التذكرة والمسارُ المجمَّع القديم
 * معاً، فلا يفترق ما يُسمح به بين طريقَي الرفع.
 */

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

export type UploadRequest = { name: string; size: number; contentType: string; kind: string; refId: string | null };
export type UploadVerdict = { ok: true; user: SessionUser; key: string } | { ok: false; status: number; error: string };

/** هل يُسمح بهذا الرفع؟ وإن سُمح، فما مفتاحه في التخزين؟ */
export async function authorizeUpload(r: UploadRequest): Promise<UploadVerdict> {
  const user = await getSession();
  if (!user) return { ok: false, status: 401, error: "unauthorized" };
  if (user.role === "ADMIN" && (await isPreview())) return { ok: false, status: 403, error: "وضع المعاينة للقراءة فقط" };
  if (!r.name || !Number.isFinite(r.size) || r.size <= 0) return { ok: false, status: 400, error: "لم يُرفق ملف" };
  if (!KINDS.has(r.kind)) return { ok: false, status: 400, error: "نوع غير صحيح" };
  if (ADMIN_KINDS.has(r.kind) && user.role !== "ADMIN") return { ok: false, status: 403, error: "غير مصرح" };
  if (!(await ownsRef(user.id, user.role, r.kind, r.refId))) return { ok: false, status: 403, error: "السجل المقصود غير موجود أو ليس لك" };
  // الرسالةُ من الحدّ نفسه: رقمٌ مكتوبٌ بيدٍ يتخلّف عنه عند أول تعديل، وقد تخلّف
  if (r.size > MAX_FILE_BYTES) return { ok: false, status: 413, error: `حجم الملف يتجاوز ${fileSize(MAX_FILE_BYTES)}` };
  if (!ALLOWED_TYPES.has(r.contentType)) return { ok: false, status: 415, error: "نوع الملف غير مسموح" };
  return { ok: true, user, key: safeKey(user.id, r.name) };
}

/**
 * صفُّ المرفق بعد أن استقرّت بايتاته في التخزين.
 *
 * ويحتمل التكرار: المفتاح فريد في المخطط، فإعادةُ الختم — من عميلٍ أعاد
 * المحاولة بعد انقطاع — تعيد الصفَّ نفسه ولا تنشئ ثانياً له.
 */
export async function commitUpload(t: UploadTicket): Promise<AttachmentItem> {
  const existing = await db.attachment.findUnique({ where: { key: t.key } });
  const att =
    existing ??
    (await db.attachment.create({
      data: { userId: t.userId, kind: t.kind, refId: t.refId, key: t.key, name: t.name.slice(0, 200), size: t.size, contentType: t.contentType },
    }));
  return toItem(att);
}
