import { db } from "./db";
import { notifyUsers } from "./notify";

export const REMINDER_AUDIENCES = {
  ALL: "الجميع",
  PARTICIPANTS: "المشاركون",
  MENTORS: "المشرفون المرافقون",
  ADMINS: "مديرو المشروع",
  ONE: "مشارك بعينه",
} as const;

export type ReminderAudience = keyof typeof REMINDER_AUDIENCES;

export function isAudience(v: string): v is ReminderAudience {
  return v in REMINDER_AUDIENCES;
}

type Target = { audience: string; userId: string | null; cohortId: string | null };

/** مستقبلو التذكير بحسب فئته ودفعته — تعريف واحد يستعمله المجدول وزر الإرسال الفوري */
export async function reminderRecipients(r: Target): Promise<string[]> {
  const scope = r.cohortId ? { cohortId: r.cohortId } : {};
  const ids = async (where: Record<string, unknown>) =>
    (await db.user.findMany({ where, select: { id: true } })).map((u) => u.id);

  switch (r.audience) {
    case "ONE":
      return r.userId ? [r.userId] : [];
    case "ADMINS":
      return ids({ role: "ADMIN", active: true });
    case "MENTORS":
      return ids({ role: "MENTOR", active: true, ...scope });
    case "ALL": {
      const rows = await db.user.findMany({ where: { active: true, OR: [scope, { role: "ADMIN" }] }, select: { id: true } });
      return [...new Set(rows.map((u) => u.id))];
    }
    default:
      return ids({ role: "PARTICIPANT", active: true, ...scope });
  }
}

/**
 * يرسل تذكيراً ويختمه بوقت إرساله، فلا يُرسل مرتين.
 * الختم يسبق الإرسال ويُشترط أن يكون التذكير غير مختوم: استدعاءان متزامنان
 * — من المجدول وزر الإرسال الفوري مثلاً — كانا يلتقطان الصف نفسه فيصل مرتين.
 */
export async function dispatchReminder(r: { id: string; title: string; body: string; url: string | null; channels: string } & Target) {
  const claimed = await db.reminder.updateMany({ where: { id: r.id, sentAt: null }, data: { sentAt: new Date() } });
  if (claimed.count !== 1) return { queued: 0 };
  const recipients = await reminderRecipients(r);
  return notifyUsers(
    recipients,
    { title: r.title, body: r.body, url: r.url ?? undefined },
    { email: r.channels === "PUSH_EMAIL" ? "always" : "fallback" },
  );
}
