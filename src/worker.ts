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
    /**
     * جدولان اثنان لا ثلاثة: سقفُ خطة Workers المجانية خمسةُ جداول **للحساب
     * كله** لا للعامل الواحد، فثالثُها يردّه النشر ويسقط معه. فحمل الجدولُ
     * الساعيُّ عملين: التذكيراتِ الثابتة في الرابعة — 07:00 بتوقيت الرياض،
     * موعدَها الذي لم يتغير — والمخصصةَ في سائر الساعات.
     *
     * وعملٌ واحد في كل استدعاء لا عملان: ميزانيةُ الخمسين طلباً فرعياً تُحسب
     * للاستدعاء كاملاً، وجمعُ العملين يبلغها في الرابعة — يومَ يكون الإرسال
     * أكثرَ ما يكون — و`once` في نقطة التذكيرات يختم اليوم قبل العمل، فما
     * سقط منه لا يُعاد. فتُزاح المخصصةُ في تلك الساعة وحدَها إلى 04:10 على
     * جدول العشر دقائق، ويصرَّف الطابور بعدها في 04:20.
     */
    const at = new Date(event.scheduledTime);
    const [hour, minute] = [at.getUTCHours(), at.getUTCMinutes()];
    // خانةُ العشر دقائق لا دقيقتها: الإطلاق قد يتأخر عن موعده دقائق
    const tenPast = minute >= 10 && minute < 20;
    const path =
      event.cron === "*/10 * * * *" ? (hour === 4 && tenPast ? "/api/cron/dispatch" : "/api/cron/drain")
      : hour === 4 ? "/api/cron/reminders"
      : "/api/cron/dispatch";
    ctx.waitUntil(
      (async () => {
        const key = await cronSecret(env);
        if (!key) return; // المنصة لم تُعدّ بعد
        const req = new Request(`${base}${path}?key=${encodeURIComponent(key)}`);
        const res = await nextApp.fetch(req, env, ctx);
        if (!res.ok) log("cron.rejected", { cron: event.cron, path, status: res.status });
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
