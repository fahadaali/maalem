import { db } from "./db";
import { getSession } from "./auth";
import type { AttachmentItem } from "@/components/Attachments";
import type { Attachment } from "@prisma/client";

/** صفّ المرفق كما يراه العميل. مُحوِّلٌ واحد، فلا يفترق شكل العنصر بين الصفحات */
type Row = { id: string; name: string; size: number; key: string; contentType: string };
export function toItem(a: Row): AttachmentItem {
  return { id: a.id, name: a.name, size: a.size, url: `/api/files/${a.key}`, contentType: a.contentType };
}

export async function listAttachments(where: { kind: string; refId?: string | null; userId?: string }): Promise<AttachmentItem[]> {
  const rows = await db.attachment.findMany({ where, orderBy: { createdAt: "asc" } });
  return rows.map(toItem);
}

/** يضيف مرفقات كل سجل معايشة إلى قائمة السجلات */
export async function withFiles<T extends { id: string }>(logs: T[]): Promise<(T & { files: AttachmentItem[] })[]> {
  if (logs.length === 0) return [];
  const rows = await db.attachment.findMany({ where: { kind: "FIELD", refId: { in: logs.map((l) => l.id) } }, orderBy: { createdAt: "asc" } });
  return logs.map((l) => ({ ...l, files: rows.filter((r) => r.refId === l.id).map(toItem) }));
}

/** مرفقات سجل واحد مفهرسةً بصاحبها — تسليمات المهمة الواحدة لعدة مشاركين */
export async function attachmentsByUser(kind: string, refId: string): Promise<Map<string, AttachmentItem[]>> {
  const rows = await db.attachment.findMany({ where: { kind, refId }, orderBy: { createdAt: "asc" } });
  const map = new Map<string, AttachmentItem[]>();
  for (const a of rows) {
    const item = toItem(a);
    map.set(a.userId, [...(map.get(a.userId) ?? []), item]);
  }
  return map;
}

/** يحذف مرفقات سجل — الصفوف وملفاتها معاً — فلا تبقى ملفات يتيمة بعد حذف السجل الذي تتبعه */
export async function removeAttachments(kind: string, refId: string): Promise<number> {
  const { deleteObject } = await import("./storage");
  const rows = await db.attachment.findMany({ where: { kind, refId }, select: { id: true, key: true } });
  for (const f of rows) {
    await deleteObject(f.key).catch(() => {});
    await db.attachment.deleteMany({ where: { id: f.id } });
  }
  return rows.length;
}

export type AttachmentAuth =
  | { status: 401 | 403 | 404 }
  | { status: 200; att: Attachment; user: NonNullable<Awaited<ReturnType<typeof getSession>>> };

/**
 * سلّم أذونات المرفق الواحد: صاحبه، ومدير المشروع، ومشرف صاحبه، ثم مواد المكتبة
 * وبطاقات الأسابيع لكل من دخل المنصة. مشتركٌ بين مسار الملفات وصفحة العارض،
 * فلا يفترق حكم من يفتح الملف عن حكم من يعرضه.
 */
export async function authorizeAttachment(where: { key: string } | { id: string }): Promise<AttachmentAuth> {
  const user = await getSession();
  if (!user) return { status: 401 };
  const att = await db.attachment.findUnique({ where });
  if (!att) return { status: 404 };
  let allowed = user.role === "ADMIN" || att.userId === user.id;
  if (!allowed && user.role === "MENTOR") {
    const owner = await db.user.findUnique({ where: { id: att.userId }, select: { mentorId: true } });
    allowed = owner?.mentorId === user.id;
  }
  // مواد المكتبة وبطاقات الأسابيع محتوى برنامج لا شواهد مشارك، فتُتاح لكل من دخل المنصة
  if (!allowed) allowed = att.kind === "MATERIAL" || att.kind === "WEEKCARD";
  // ما عدا ذلك — ملفات المشاريع والشواهد — لصاحبها ومشرفه ومدير المشروع وحدهم
  return allowed ? { status: 200, att, user } : { status: 403 };
}
