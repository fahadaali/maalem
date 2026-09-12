// نقطة دخول Worker مخصصة: تغلّف تطبيق OpenNext وتضيف معالج Cron للتذكيرات اليومية
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore يُولَّد هذا الملف عند البناء بـ opennextjs-cloudflare build
import nextApp from "../.open-next/worker.js";

/** مفتاح نقطة التذكيرات: من قاعدة البيانات (يُولَّد تلقائياً) أو من متغير بيئة إن ضُبط */
async function cronSecret(env: CloudflareEnv): Promise<string> {
  if (env.CRON_SECRET) return env.CRON_SECRET;
  try {
    const row = await env.DB.prepare("SELECT value FROM Setting WHERE key = ?").bind("secret:cron").first<{ value: string }>();
    return row?.value ?? "";
  } catch {
    return "";
  }
}

export default {
  fetch: nextApp.fetch,
  async scheduled(event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    const base = env.APP_URL || "https://maalem.local";
    // الجدول اليومي يشغّل تذكيرات البرنامج الثابتة، والجدول الساعي يرسل التذكيرات المخصصة في مواعيدها.
    // الساعة الرابعة يطابقها الجدولان معاً، فلا يُرسل اليوميُّ المخصصةَ كي لا تُرسل مرتين.
    const paths = event.cron === "0 4 * * *" ? ["/api/cron/reminders"] : ["/api/cron/dispatch"];
    ctx.waitUntil(
      (async () => {
        const key = await cronSecret(env);
        if (!key) return; // المنصة لم تُعدّ بعد
        for (const path of paths) {
          const req = new Request(`${base}${path}?key=${encodeURIComponent(key)}`);
          await nextApp.fetch(req, env, ctx);
        }
      })(),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore إعادة تصدير كائنات OpenNext الدائمة
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";
