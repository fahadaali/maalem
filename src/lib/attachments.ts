import { db } from "./db";
import type { AttachmentItem } from "@/components/Attachments";

export async function listAttachments(where: { kind: string; refId?: string | null; userId?: string }): Promise<AttachmentItem[]> {
  const rows = await db.attachment.findMany({ where, orderBy: { createdAt: "asc" } });
  return rows.map((a) => ({ id: a.id, name: a.name, size: a.size, url: `/api/files/${a.key}` }));
}

/** يضيف مرفقات كل سجل معايشة إلى قائمة السجلات */
export async function withFiles<T extends { id: string }>(logs: T[]): Promise<(T & { files: AttachmentItem[] })[]> {
  if (logs.length === 0) return [];
  const rows = await db.attachment.findMany({ where: { kind: "FIELD", refId: { in: logs.map((l) => l.id) } }, orderBy: { createdAt: "asc" } });
  return logs.map((l) => ({ ...l, files: rows.filter((r) => r.refId === l.id).map((a) => ({ id: a.id, name: a.name, size: a.size, url: `/api/files/${a.key}` })) }));
}
