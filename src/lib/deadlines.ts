import { db } from "./db";

/**
 * مواعيد التسليم المُمدَّدة لمهمة: لكل مشارك قُبل له تأجيل، أبعدُ تاريخ اعتُمد له.
 * تأجيل مقبول لا أثر له كان يعني أن التسليم يُرصد متأخراً رغم قبول الطلب.
 */
export async function extensionsFor(assignmentId: string, userIds?: string[]): Promise<Map<string, Date>> {
  const rows = await db.excuseRequest.findMany({
    where: { kind: "EXTENSION", status: "APPROVED", assignmentId, untilAt: { not: null }, ...(userIds ? { userId: { in: userIds } } : {}) },
    select: { userId: true, untilAt: true },
  });
  const map = new Map<string, Date>();
  for (const r of rows) {
    if (!r.untilAt) continue;
    const prev = map.get(r.userId);
    if (!prev || r.untilAt > prev) map.set(r.userId, r.untilAt);
  }
  return map;
}
