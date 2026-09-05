import { db } from "./db";
import { generateVapidKeys } from "./webpush";

/**
 * أسرار المنصة: تُولَّد تلقائياً عند أول حاجة إليها وتُحفظ في قاعدة البيانات،
 * فلا تحتاج ضبطاً يدوياً. ويمكن تجاوزها بمتغيرات البيئة عند الرغبة.
 */
const KEYS = {
  auth: "secret:auth",
  cron: "secret:cron",
  vapidPublic: "secret:vapid_public",
  vapidPrivate: "secret:vapid_private",
} as const;

// ذاكرة داخل النسخة العاملة لتفادي قراءة القاعدة في كل طلب
const cache = new Map<string, string>();

function randomSecret(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function read(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value || null;
}

/** يقرأ السر، وإن لم يوجد ولّده وحفظه (مع تحمّل التسابق بين نسختين). */
async function getOrCreate(key: string, generate: () => Promise<string> | string): Promise<string> {
  const hit = cache.get(key);
  if (hit) return hit;
  const existing = await read(key);
  if (existing) {
    cache.set(key, existing);
    return existing;
  }
  const value = await generate();
  try {
    await db.setting.create({ data: { key, value } });
  } catch {
    const raced = await read(key);
    if (raced) {
      cache.set(key, raced);
      return raced;
    }
  }
  cache.set(key, value);
  return value;
}

/** مفتاح توقيع الجلسات */
export async function getAuthSecret(): Promise<string> {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  return getOrCreate(KEYS.auth, () => randomSecret(32));
}

/** مفتاح حماية نقطة التذكيرات */
export async function getCronSecret(): Promise<string> {
  const fromEnv = process.env.CRON_SECRET;
  if (fromEnv) return fromEnv;
  return getOrCreate(KEYS.cron, () => randomSecret(24));
}

export type Vapid = { publicKey: string; privateKey: string; subject: string };

/** مفاتيح إشعارات الدفع: تُولَّد مرة واحدة وتبقى ثابتة حتى لا تتعطل اشتراكات الأجهزة */
export async function getVapid(): Promise<Vapid> {
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  const envPub = process.env.VAPID_PUBLIC_KEY;
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  if (envPub && envPriv) return { publicKey: envPub, privateKey: envPriv, subject };

  const cachedPub = cache.get(KEYS.vapidPublic);
  const cachedPriv = cache.get(KEYS.vapidPrivate);
  if (cachedPub && cachedPriv) return { publicKey: cachedPub, privateKey: cachedPriv, subject };

  const [pub, priv] = await Promise.all([read(KEYS.vapidPublic), read(KEYS.vapidPrivate)]);
  if (pub && priv) {
    cache.set(KEYS.vapidPublic, pub);
    cache.set(KEYS.vapidPrivate, priv);
    return { publicKey: pub, privateKey: priv, subject };
  }

  const keys = await generateVapidKeys();
  await db.setting
    .createMany({ data: [{ key: KEYS.vapidPublic, value: keys.publicKey }, { key: KEYS.vapidPrivate, value: keys.privateKey }] })
    .catch(() => {});
  const [pub2, priv2] = await Promise.all([read(KEYS.vapidPublic), read(KEYS.vapidPrivate)]);
  const publicKey = pub2 ?? keys.publicKey;
  const privateKey = priv2 ?? keys.privateKey;
  cache.set(KEYS.vapidPublic, publicKey);
  cache.set(KEYS.vapidPrivate, privateKey);
  return { publicKey, privateKey, subject };
}

/** يولّد كل الأسرار مقدماً (يُستدعى في الإعداد الأولي) */
export async function ensureAllSecrets(): Promise<void> {
  await Promise.all([getAuthSecret(), getCronSecret(), getVapid()]);
}
