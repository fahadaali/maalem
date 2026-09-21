/**
 * تذكرةُ رفعٍ موقّعة: يُصدرها Next بعد الاستيثاق، ويتحقّق منها غلافُ العامل قبل
 * أن يمرّر بايتات الملف إلى R2.
 *
 * ولمَ تذكرةٌ أصلاً؟ لأن محوّل OpenNext يقرأ جسم كلِّ طلبٍ غير GET **كاملاً في
 * الذاكرة** قبل أن يبلغ معالجَ المسار، ثم `formData()` تفكّه فتصير نسختين،
 * وحدُّ النسخة العاملة مئةٌ وثمانٍ وعشرون ميغابايت — فملفُ الخمسين يسقط بـ1102
 * مهما صُنع داخل Next. فصار مسارُ البايتات يُعترض في `src/worker.ts` قبل Next،
 * وبقي الحكمُ كلُّه في Next: التذكرةُ هي ما ينقله إلى الغلاف بلا أن يُعيده.
 *
 * ووحدةٌ نقيّة بلا استيرادٍ من Next ولا من القاعدة عمداً: تُستورد في الحزمتين
 * معاً، وتكرارُ دوالَّ بلا حالةٍ لا يضرّ.
 */

/** ما تشهد به التذكرة: ملفٌ بعينه لصاحبٍ بعينه في موضعٍ بعينه */
export type UploadClaim = {
  /** مفتاح الكائن في R2 — يبدأ بمعرّف صاحبه */
  key: string;
  userId: string;
  kind: string;
  refId: string | null;
  name: string;
  size: number;
  contentType: string;
};

export type UploadTicket = UploadClaim & { /** ثوانٍ منذ الحقبة */ exp: number };

/**
 * نصفُ ساعة: مهلةُ العميل تسع خمسين ميغابايت على أبطأ ما يُحتمل من الشبكات
 * (نحو عشر دقائق)، وهذه ضِعفُها فلا تنتهي تذكرةُ رفعٍ يجري، ولا تبقى صالحةً
 * يوماً بعد أن سقط التحقق الذي أصدرها.
 */
const TTL_SECONDS = 30 * 60;

const enc = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  let s = "";
  // حلقةٌ لا `...bytes`: النشرُ يبلغ حدَّ وسائط النداء في التواقيع الطويلة
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** يوقّع تذكرةً تنتهي بعد نصف ساعة */
export async function signTicket(secret: string, claim: UploadClaim): Promise<string> {
  const ticket: UploadTicket = { ...claim, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const payload = toB64Url(enc.encode(JSON.stringify(ticket)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), enc.encode(payload)));
  return `${payload}.${toB64Url(sig)}`;
}

/** يعيد التذكرة إن صحّ توقيعها ولم تنتهِ، وإلا `null` */
export async function verifyTicket(secret: string, token: string): Promise<UploadTicket | null> {
  if (!secret || !token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await signingKey(secret), fromB64Url(sig) as BufferSource, enc.encode(payload));
    if (!ok) return null;
    const ticket = JSON.parse(new TextDecoder().decode(fromB64Url(payload))) as UploadTicket;
    if (!ticket?.key || !ticket.userId || !ticket.exp || ticket.exp * 1000 < Date.now()) return null;
    return ticket;
  } catch {
    // توقيعٌ مشوَّه أو حمولةٌ ليست JSON: رفضٌ لا انهيار
    return null;
  }
}
