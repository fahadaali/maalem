import { db } from "./db";
import { PushError, sendPush } from "./webpush";
import { getVapid } from "./secrets";
import { cohortWhere } from "./cohort";
import { sendEmail } from "./email";

export type NotifyPayload = { title: string; body: string; url?: string };

/** متى يُستعمل البريد: احتياطياً لمن لا جهاز مشترك له، أو دائماً، أو أبداً. */
export type EmailMode = "fallback" | "always" | "never";

function absolute(url?: string) {
  const base = process.env.APP_URL;
  if (!url) return base || undefined;
  if (/^https?:\/\//.test(url)) return url;
  return base ? `${base.replace(/\/$/, "")}${url}` : undefined;
}

/** ينشئ إشعاراً داخل المنصة لكل مستخدم ويرسل إشعار دفع لأجهزته المشتركة، ويُتبعه بالبريد عند الحاجة. */
export async function notifyUsers(userIds: string[], payload: NotifyPayload, opts: { email?: EmailMode } = {}) {
  if (userIds.length === 0) return { inApp: 0, pushed: 0, emailed: 0 };
  await db.notification.createMany({
    data: userIds.map((userId) => ({ userId, title: payload.title, body: payload.body, url: payload.url ?? null })),
  });
  let pushed = 0;
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  if (subs.length > 0) {
    const v = await getVapid();
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
  const mode: EmailMode = opts.email ?? "fallback";
  let emailed = 0;
  if (mode !== "never") {
    const withPush = new Set(subs.map((s) => s.userId));
    const targets = mode === "always" ? userIds : userIds.filter((id) => !withPush.has(id));
    if (targets.length) {
      const users = await db.user.findMany({
        where: { id: { in: targets }, active: true, emailOptIn: true, NOT: { email: null } },
        select: { email: true },
      });
      const addresses = users.map((u) => u.email!).filter(Boolean);
      if (addresses.length) emailed = await sendEmail(addresses, payload.title, payload.body, absolute(payload.url));
    }
  }

  return { inApp: userIds.length, pushed, emailed };
}

export async function notifyRole(role: "ADMIN" | "PARTICIPANT" | "MENTOR", payload: NotifyPayload, opts: { email?: EmailMode } = {}) {
  // مديرو المشروع عامّون، وأما المشاركون والمشرفون فبحسب الدفعة النشطة
  const scope = role === "ADMIN" ? {} : await cohortWhere();
  const users = await db.user.findMany({ where: { role, active: true, ...scope }, select: { id: true } });
  return notifyUsers(users.map((u) => u.id), payload, opts);
}

export async function notifyAdmins(payload: NotifyPayload, opts: { email?: EmailMode } = {}) {
  return notifyRole("ADMIN", payload, opts);
}

/** المفتاح العام لإشعارات الدفع — يُولَّد تلقائياً عند أول طلب ويبقى ثابتاً */
export async function vapidPublicKey(): Promise<string | null> {
  try {
    return (await getVapid()).publicKey;
  } catch {
    return null;
  }
}

export async function pushEnabled(): Promise<boolean> {
  return (await vapidPublicKey()) !== null;
}
