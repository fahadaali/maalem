/**
 * إرسال إشعارات الدفع (Web Push) بالاعتماد على WebCrypto فقط،
 * ليعمل على Cloudflare Workers وNode دون حزم أصلية.
 * يطبّق RFC 8291 (تشفير aes128gcm) وRFC 8292 (VAPID).
 */

const te = new TextEncoder();

export function b64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bits: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource }, key, bits));
}

/** مفاتيح VAPID: العام (65 بايت غير مضغوط) والخاص (32 بايت) بترميز base64url */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const pub = concat(new Uint8Array([4]), b64urlDecode(jwk.x!), b64urlDecode(jwk.y!));
  return { publicKey: b64url(pub), privateKey: jwk.d! };
}

async function vapidAuthorization(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
  const pub = b64urlDecode(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("مفتاح VAPID العام غير صالح");
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: privateKey };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64url(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const aud = new URL(endpoint).origin;
  const payload = b64url(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(signingInput));
  return `vapid t=${signingInput}.${b64url(sig)}, k=${publicKey}`;
}

/** تشفير الحمولة وفق aes128gcm (RFC 8291) */
export async function encryptPayload(p256dh: string, auth: string, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(p256dh);
  const authSecret = b64urlDecode(auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("مفاتيح الاشتراك غير صالحة");

  const asPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asPair.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPair.privateKey, 256));

  const keyInfo = concat(te.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 96);

  const plaintext = concat(payload, new Uint8Array([2])); // فاصل السجل الأخير
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, plaintext as BufferSource));

  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);
  return concat(header, ciphertext);
}

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
export type VapidDetails = { publicKey: string; privateKey: string; subject: string };

export class PushError extends Error {
  statusCode: number;
  body: string;
  constructor(statusCode: number, body: string) {
    super(`push failed: ${statusCode}`);
    this.statusCode = statusCode;
    this.body = body;
  }
}

/** يرسل إشعاراً إلى اشتراك واحد. يرمي PushError عند رفض خدمة الدفع. */
export async function sendPush(sub: PushSub, payload: string, vapid: VapidDetails, opts: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" } = {}): Promise<void> {
  const body = await encryptPayload(sub.keys.p256dh, sub.keys.auth, te.encode(payload));
  const authorization = await vapidAuthorization(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(body.length),
      TTL: String(opts.ttl ?? 86400),
      Urgency: opts.urgency ?? "normal",
    },
    body: body as BodySource,
  });
  if (res.status < 200 || res.status >= 300) throw new PushError(res.status, await res.text().catch(() => ""));
}

type BodySource = BodyInit;
