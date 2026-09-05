// يولّد مفاتيح VAPID لإشعارات الدفع (WebCrypto) ويطبعها لإضافتها إلى ملف البيئة أو أسرار Cloudflare
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
console.log(`VAPID_PUBLIC_KEY="${b64url(pub)}"`);
console.log(`VAPID_PRIVATE_KEY="${jwk.d}"`);
