import { db } from "./db";

export type EmailConfig = { provider: "resend" | "brevo"; apiKey: string; from: string; fromName: string };

const KEYS = {
  provider: "email:provider",
  apiKey: "email:apiKey",
  from: "email:from",
  fromName: "email:fromName",
} as const;

async function settings(): Promise<Record<string, string>> {
  try {
    const rows = await db.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

/** إعداد البريد إن ضُبط، وإلا فلا قناة بريد. متغيرات البيئة تسبق ما في القاعدة. */
export async function emailConfig(): Promise<EmailConfig | null> {
  const s = await settings();
  const apiKey = process.env.EMAIL_API_KEY || s[KEYS.apiKey] || "";
  const from = process.env.EMAIL_FROM || s[KEYS.from] || "";
  if (!apiKey || !from) return null;
  const provider = (process.env.EMAIL_PROVIDER || s[KEYS.provider] || "resend") as EmailConfig["provider"];
  return { provider: provider === "brevo" ? "brevo" : "resend", apiKey, from, fromName: s[KEYS.fromName] || "معالم التربية" };
}

export async function saveEmailConfig(input: { provider: string; apiKey: string; from: string; fromName: string }) {
  const pairs: [string, string][] = [
    [KEYS.provider, input.provider === "brevo" ? "brevo" : "resend"],
    [KEYS.from, input.from.trim()],
    [KEYS.fromName, input.fromName.trim() || "معالم التربية"],
  ];
  if (input.apiKey.trim()) pairs.push([KEYS.apiKey, input.apiKey.trim()]);
  for (const [key, value] of pairs) {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
}

export async function clearEmailConfig() {
  await db.setting.deleteMany({ where: { key: { in: Object.values(KEYS) } } });
}

export async function emailEnabled(): Promise<boolean> {
  return (await emailConfig()) !== null;
}

function htmlBody(title: string, body: string, url?: string) {
  const link = url ? `<p style="margin:24px 0 0"><a href="${escapeHtml(url)}" style="background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">فتح المنصة</a></p>` : "";
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f6f6f6;font-family:Tahoma,Arial,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;padding:28px 22px;background:#fff">
<div style="font-size:12px;color:#737373;margin-bottom:14px">معالم التربية</div>
<h1 style="font-size:20px;margin:0 0 10px">${escapeHtml(title)}</h1>
<div style="font-size:15px;line-height:1.9;white-space:pre-wrap">${escapeHtml(body)}</div>
${link}
<hr style="border:none;border-top:1px solid #e4e4e4;margin:26px 0 12px">
<div style="font-size:11px;color:#737373">وصلتك هذه الرسالة لأن تنبيهات البريد مفعّلة في حسابك. يمكنك إيقافها من إعدادات المنصة.</div>
</div></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/**
 * مهلة كل رسالة. والحلقة أدناه متتابعة، فمزوّدٌ يخنق الطلبات أو لا يردّ كان
 * يُعلّق الإجراء المستدعي بلا نهاية — وهو ما يراه المستخدم دوراناً لا ينتهي.
 */
const EXTERNAL_TIMEOUT_MS = 10_000;

/** يرسل رسالة واحدة إلى عدة عناوين. يعيد عدد ما أُرسل، ولا يرمي استثناءً على فشل مزوّد. */
export async function sendEmail(to: string[], title: string, body: string, url?: string): Promise<number> {
  const cfg = await emailConfig();
  const addresses = [...new Set(to.filter((a) => /.+@.+\..+/.test(a)))];
  if (!cfg || addresses.length === 0) return 0;
  const html = htmlBody(title, body, url);
  let sent = 0;
  for (const address of addresses) {
    try {
      const res =
        cfg.provider === "brevo"
          ? await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: { "api-key": cfg.apiKey, "content-type": "application/json" },
              body: JSON.stringify({ sender: { email: cfg.from, name: cfg.fromName }, to: [{ email: address }], subject: title, htmlContent: html }),
              signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
            })
          : await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
              body: JSON.stringify({ from: `${cfg.fromName} <${cfg.from}>`, to: address, subject: title, html }),
              signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
            });
      if (res.ok) sent++;
      else console.warn("email failed", res.status, (await res.text()).slice(0, 200));
    } catch (e) {
      console.warn("email error", (e as Error).message);
    }
  }
  return sent;
}
