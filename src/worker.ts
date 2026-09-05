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
  async scheduled(_event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    const base = env.APP_URL || "https://maalem.local";
    ctx.waitUntil(
      (async () => {
        const key = await cronSecret(env);
        if (!key) return; // المنصة لم تُعدّ بعد
        const req = new Request(`${base}/api/cron/reminders?key=${encodeURIComponent(key)}`);
        await nextApp.fetch(req, env, ctx);
      })(),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore إعادة تصدير كائنات OpenNext الدائمة
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";
