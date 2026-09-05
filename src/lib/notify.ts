import webpush from "web-push";
import { db } from "./db";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export type NotifyPayload = { title: string; body: string; url?: string };

/** ينشئ إشعاراً داخل المنصة لكل مستخدم ويرسل إشعار دفع لأجهزته المشتركة. */
export async function notifyUsers(userIds: string[], payload: NotifyPayload) {
  if (userIds.length === 0) return { inApp: 0, pushed: 0 };
  await db.notification.createMany({
    data: userIds.map((userId) => ({ userId, title: payload.title, body: payload.body, url: payload.url ?? null })),
  });
  let pushed = 0;
  if (ensureConfigured()) {
    const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24 },
          );
          pushed++;
        } catch (e: unknown) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
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
  return ensureConfigured();
}
