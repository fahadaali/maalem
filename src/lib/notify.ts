import { db } from "./db";
import { PushError, sendPush } from "./webpush";
import { getVapid } from "./secrets";
import { cohortWhere } from "./cohort";
import { sendEmail } from "./email";
import { log, reason } from "./log";

export type NotifyPayload = { title: string; body: string; url?: string };

/** متى يُستعمل البريد: احتياطياً لمن لا جهاز مشترك له، أو دائماً، أو أبداً. */
export type EmailMode = "fallback" | "always" | "never";

function absolute(url?: string) {
  const base = process.env.APP_URL;
  if (!url) return base || undefined;
  if (/^https?:\/\//.test(url)) return url;
  return base ? `${base.replace(/\/$/, "")}${url}` : undefined;
}

export type NotifyResult = { queued: number };

/**
 * يُدرج إشعاراً لكل مستخدم في الطابور. **استعلامٌ واحد مهما كان العدد.**
 *
 * وكان يدفع ويُبرد هنا أيضاً: M+E+9 طلباً فرعياً في طلبٍ سقفُه خمسون، و`Promise.all`
 * يطلق M دفعةً واحدة أمام سقف **ست** وصلات متزامنة — فالسابع فصاعداً تنفد مهلته
 * وهو في الطابور قبل أن يتصل. فصار التسليم في `/api/cron/drain` بميزانيته
 * المستقلة، وصار زمنُ الإجراء الذي يُشعر مستقلاً عن عدد المستقبلين.
 */
export async function notifyUsers(userIds: string[], payload: NotifyPayload, opts: { email?: EmailMode } = {}): Promise<NotifyResult> {
  if (userIds.length === 0) return { queued: 0 };
  await db.notification.createMany({
    data: userIds.map((userId) => ({ userId, title: payload.title, body: payload.body, url: payload.url ?? null, emailMode: opts.email ?? "fallback" })),
  });
  return { queued: userIds.length };
}

export type DrainResult = { taken: number; pushed: number; emailed: number; left: number };

/** كم إشعاراً يُقرأ في التصريفة الواحدة */
const BATCH = 30;
/**
 * ميزانيةُ الاتصالات الخارجية في التصريفة: دفعٌ وبريد. السقف الصلب خمسون طلباً
 * فرعياً، وما بقي للاستعلامات الخمسة وختمِ التسليم. وما تجاوزها يبقى في الطابور
 * للتصريفة التالية — كلُّ عشر دقائق — لا يضيع.
 */
const EXTERNAL_BUDGET = 30;
/**
 * وصلاتٌ متزامنة. العامل يسمح بستٍّ، وما زاد ينتظر في طابور، ومهلةُ الرسالة عشر
 * ثوانٍ تجري عليه وهو منتظر — فالمتأخر تنفد مهلته قبل أن يتصل أصلاً.
 */
const CONCURRENCY = 6;
/**
 * أجهزةُ المستخدم الواحد في التصريفة. أحدثُها خمسةً، فمستخدمٌ باشتراكاتٍ قديمة
 * متراكمة لا يبتلع ميزانية الجميع.
 */
const MAX_DEVICES = 5;

/** يشغّل المهامّ بعددٍ محدود من الوصلات المتزامنة، بلا `Promise.all` يفتحها كلَّها */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

type Queued = { id: string; userId: string; title: string; body: string; url: string | null; emailMode: string };

/**
 * يُسلّم صفوفاً بعينها: دفعاً لأجهزتها، ثم بريداً لمن لم يصله دفعٌ فعلاً.
 * ويختم ما عالجه بـ`deliveredAt` — الصفوف المتروكة لنفاد الميزانية تبقى بلا ختم.
 */
async function deliver(queued: Queued[]): Promise<DrainResult> {
  if (queued.length === 0) return { taken: 0, pushed: 0, emailed: 0, left: 0 };
  const userIds = [...new Set(queued.map((n) => n.userId))];
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } }, orderBy: { id: "desc" } });
  const byUser = new Map<string, typeof subs>();
  for (const s of subs) {
    const list = byUser.get(s.userId) ?? [];
    if (list.length < MAX_DEVICES) list.push(s);
    byUser.set(s.userId, list);
  }

  /**
   * خطةُ الإرسال بترتيب الورود، تُقطع عند نفاد الميزانية. والكلفة تُحجز بأعلاها
   * — جهازاً لكل اشتراك ورسالةً للبريد — فلا تُتجاوز الميزانية بحالٍ وإن فشل الدفع.
   */
  const take: Queued[] = [];
  let reserved = 0;
  for (const n of queued) {
    const mine = byUser.get(n.userId) ?? [];
    const cost = mine.length + (n.emailMode === "never" ? 0 : 1);
    if (take.length && reserved + cost > EXTERNAL_BUDGET) break;
    reserved += cost;
    take.push(n);
  }

  let pushed = 0;
  /** الإشعارات التي وصلها دفعٌ على جهاز واحد على الأقل — البريد الاحتياطي لما سواها */
  const delivered = new Set<string>();
  const jobs = take.flatMap((n) => (byUser.get(n.userId) ?? []).map((s) => ({ n, s })));
  if (jobs.length) {
    const v = await getVapid();
    /**
     * عدد غير المقروء لكل مستخدم يُرسل مع الإشعار، فيضع النظام الرقم على أيقونة
     * التطبيق والتطبيق مغلق — استعلام واحد لكل المستقبلين لا لكل جهاز.
     */
    const grouped = await db.notification.groupBy({ by: ["userId"], where: { userId: { in: userIds }, readAt: null }, _count: { _all: true } });
    const unread = new Map(grouped.map((g) => [g.userId, g._count._all]));
    await pool(jobs, CONCURRENCY, async ({ n, s }) => {
      const message = JSON.stringify({ title: n.title, body: n.body, url: n.url ?? undefined, count: unread.get(n.userId) ?? 1 });
      try {
        await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, v, { ttl: 86400 });
        pushed++;
        delivered.add(n.id);
      } catch (e) {
        if (e instanceof PushError && e.dead) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          log("push.failed", { reason: e instanceof PushError ? String(e.statusCode) : reason(e) });
        }
      }
    });
  }

  // الاحتياط لمن لم يصله دفعٌ فعلاً، لا لمن لا اشتراك له فقط: اشتراك انتهى للتو أو فشل لا يُغني عن البريد
  let emailed = 0;
  const wantsEmail = take.filter((n) => n.emailMode === "always" || (n.emailMode !== "never" && !delivered.has(n.id)));
  if (wantsEmail.length) {
    const users = await db.user.findMany({
      where: { id: { in: [...new Set(wantsEmail.map((n) => n.userId))] }, active: true, emailOptIn: true, NOT: { email: null } },
      select: { id: true, email: true },
    });
    const address = new Map(users.map((u) => [u.id, u.email!]));
    // رسالةٌ واحدة لكل متنٍ متكرر: تذكيرُ ثلاثين مشاركاً نصٌّ واحد، فيُرسل بنداءٍ واحد
    const groups = new Map<string, { n: Queued; to: string[] }>();
    for (const n of wantsEmail) {
      const to = address.get(n.userId);
      if (!to) continue;
      const key = `${n.title}\u0000${n.body}\u0000${n.url ?? ""}`;
      const g = groups.get(key) ?? { n, to: [] };
      g.to.push(to);
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      emailed += await sendEmail(g.to, g.n.title, g.n.body, absolute(g.n.url ?? undefined));
    }
  }

  await db.notification.updateMany({ where: { id: { in: take.map((n) => n.id) } }, data: { deliveredAt: new Date() } });
  const result = { taken: take.length, pushed, emailed, left: queued.length - take.length };
  log("notify.drained", result);
  return result;
}

/** يصرّف الطابور: أقدمُ ما لم يُسلَّم أولاً، في حدود ميزانية التصريفة */
export async function drainNotifications(): Promise<DrainResult> {
  const queued = await db.notification.findMany({
    where: { deliveredAt: null },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, userId: true, title: true, body: true, url: true, emailMode: true },
  });
  return deliver(queued);
}

/**
 * يُسلّم إشعارات مستخدمٍ بعينه فوراً. لزرّ «تجربة الإشعارات» وحده: تجربةٌ تقول
 * «سيصلك خلال دقائق» لا تُجرِّب شيئاً.
 */
export async function deliverNow(userId: string): Promise<DrainResult> {
  const queued = await db.notification.findMany({
    where: { userId, deliveredAt: null },
    orderBy: { createdAt: "asc" },
    take: MAX_DEVICES,
    select: { id: true, userId: true, title: true, body: true, url: true, emailMode: true },
  });
  return deliver(queued);
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
