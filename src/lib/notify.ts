import { db } from "./db";
import { PushError, sendPush, type VapidDetails } from "./webpush";

function vapid(): VapidDetails | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:admin@example.com" };
}

export type NotifyPayload = { title: string; body: string; url?: string };

/** ينشئ إشعاراً داخل المنصة لكل مستخدم ويرسل إشعار دفع لأجهزته المشتركة. */
export async function notifyUsers(userIds: string[], payload: NotifyPayload) {
  if (userIds.length === 0) return { inApp: 0, pushed: 0 };
  await db.notification.createMany({
    data: userIds.map((userId) => ({ userId, title: payload.title, body: payload.body, url: payload.url ?? null })),
  });
  let pushed = 0;
  const v = vapid();
  if (v) {
    const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
    const message = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, v, { ttl: 86400 });
          pushed++;
        } catch (e) {
          if (e instanceof PushError && (e.statusCode === 404 || e.statusCode === 410)) {
            await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          } else {
            console.warn("push failed", e instanceof PushError ? e.statusCode : (e as Error).message);
          }
        }
      }),
    );
  }
  return { inApp: userIds.length, pushed };
}

export async function notifyRole(role: "ADMIN" | "PARTICIPANT" | "MENTOR", payload: NotifyPayload) {
  const users = await db.user.findMany({ where: { role, active: true }, select: { id: true } });
  return notifyUsers(users.map((u) => u.id), payload);
}

export async function notifyAdmins(payload: NotifyPayload) {
  return notifyRole("ADMIN", payload);
}

export function pushEnabled() {
  return vapid() !== null;
}

/** المفتاح العام لإشعارات الدفع (يُقرأ وقت التشغيل ليعمل مع أسرار Cloudflare) */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}
