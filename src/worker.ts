// نقطة دخول Worker مخصصة: تغلّف تطبيق OpenNext وتضيف معالج Cron للتذكيرات اليومية
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore يُولَّد هذا الملف عند البناء بـ opennextjs-cloudflare build
import nextApp from "../.open-next/worker.js";

/**
 * سطرُ سجلٍّ بصيغة `src/lib/log.ts` نفسها، مكتوبٌ هنا لا مستورداً عمداً: هذا
 * الملف حزمةٌ مستقلة عن حزمة Next، فاستيراده يضاعف الوحدة بمعرّف نسخةٍ ثانٍ
 * يُربك قراءة السجل. ولا معرّف نسخةٍ هنا: الغلاف لا يُقلع شيئاً.
 */
function log(evt: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ app: "maalem", evt, at: "worker", ...data }));
}

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
  /**
   * تُكتب دالّةً لا `fetch: nextApp.fetch`: المرجع المنفصل يفقد `this`، فيعمل
   * اليوم لأن OpenNext لا يستعمله، وتكسره ترقيةٌ صغرى بلا إنذار — وكلُّ طلبٍ
   * حينها 1101. والتغليف يكلّف إطار نداءٍ واحداً ويجعل العقد صريحاً.
   */
  async fetch(req: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    return nextApp.fetch(req, env, ctx);
  },
  async scheduled(event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    const base = env.APP_URL || "https://maalem.local";
    // الجدول اليومي يشغّل تذكيرات البرنامج الثابتة، والجدول الساعي يرسل التذكيرات المخصصة في مواعيدها،
    // وجدولُ العشر دقائق يصرّف طابور الإشعارات إلى الأجهزة والبريد.
    // الساعة الرابعة يطابقها الجدولان معاً، فلا يُرسل اليوميُّ المخصصةَ كي لا تُرسل مرتين.
    const paths =
      event.cron === "0 4 * * *" ? ["/api/cron/reminders"]
      : event.cron === "*/10 * * * *" ? ["/api/cron/drain"]
      : ["/api/cron/dispatch"];
    ctx.waitUntil(
      (async () => {
        const key = await cronSecret(env);
        if (!key) return; // المنصة لم تُعدّ بعد
        for (const path of paths) {
          const req = new Request(`${base}${path}?key=${encodeURIComponent(key)}`);
          const res = await nextApp.fetch(req, env, ctx);
          if (!res.ok) log("cron.rejected", { cron: event.cron, path, status: res.status });
        }
      })().catch((e: unknown) => {
        // رفضٌ غير ملتقَط في `waitUntil` يُسقط الاستدعاء المجدول كله بلا أثرٍ مقروء
        log("cron.failed", { cron: event.cron, reason: String((e as Error)?.message ?? e) });
      }),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore إعادة تصدير كائنات OpenNext الدائمة
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";
