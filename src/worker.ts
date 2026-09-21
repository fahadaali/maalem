// نقطة دخول Worker مخصصة: تغلّف تطبيق OpenNext وتضيف معالج Cron للتذكيرات اليومية
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore يُولَّد هذا الملف عند البناء بـ opennextjs-cloudflare build
import nextApp from "../.open-next/worker.js";
import { verifyTicket } from "./lib/upload-ticket";

/**
 * سطرُ سجلٍّ بصيغة `src/lib/log.ts` نفسها، مكتوبٌ هنا لا مستورداً عمداً: هذا
 * الملف حزمةٌ مستقلة عن حزمة Next، فاستيراده يضاعف الوحدة بمعرّف نسخةٍ ثانٍ
 * يُربك قراءة السجل. ولا معرّف نسخةٍ هنا: الغلاف لا يُقلع شيئاً.
 */
function log(evt: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ app: "maalem", evt, at: "worker", ...data }));
}

/** قيمةُ إعدادٍ من القاعدة مباشرةً: الغلافُ حزمةٌ مستقلة، لا Prisma فيه ولا سياقَ طلبٍ لـNext */
async function setting(env: CloudflareEnv, key: string): Promise<string> {
  try {
    const row = await env.DB.prepare("SELECT value FROM Setting WHERE key = ?").bind(key).first<{ value: string }>();
    return row?.value ?? "";
  } catch {
    return "";
  }
}

/** مفتاح نقطة التذكيرات: من قاعدة البيانات (يُولَّد تلقائياً) أو من متغير بيئة إن ضُبط */
async function cronSecret(env: CloudflareEnv): Promise<string> {
  return env.CRON_SECRET || (await setting(env, "secret:cron"));
}

/** مفتاح توقيع الجلسات — وبه تُوقَّع تذاكر الرفع. يُقرأ بلا توليد: التوليد لـNext */
async function authSecret(env: CloudflareEnv): Promise<string> {
  return env.AUTH_SECRET || (await setting(env, "secret:auth"));
}

const json = (data: unknown, status: number): Response => Response.json(data, { status });

/**
 * الرفعُ المتدفّق إلى R2، يُعترض **قبل** Next عمداً.
 *
 * فمحوّلُ OpenNext يقرأ جسم كلِّ طلبٍ غير GET كاملاً في الذاكرة قبل أن يبلغ
 * معالجَ المسار — `Buffer.from(await event.arrayBuffer())` — ثم `formData()`
 * تفكّه فتصير نسختين، وحدُّ النسخة العاملة مئةٌ وثمانٍ وعشرون ميغابايت. فملفُ
 * الخمسين كان يسقط بـ1102 مهما صُنع داخل معالج المسار: الجسمُ مُجمَّعٌ قبل أن
 * يراه. وهنا تمرّ البايتات تيّاراً إلى R2 بلا أن تُجمع، ولا تُقرأ في الذاكرة
 * أصلاً — فلا ذروةَ ذاكرةٍ ولا زمنَ معالجٍ في فكّ تجميع.
 *
 * والاستيثاقُ سبقها في ‎/api/upload/ticket وتحمله التذكرة الموقّعة، فلا يُعاد
 * هنا حكمٌ ولا يُكتب في الغلاف نسخةٌ ثانية منه.
 */
async function streamUpload(req: Request, env: CloudflareEnv, ctx: ExecutionContext, url: URL): Promise<Response> {
  const token = url.searchParams.get("ticket") ?? "";
  const ticket = await verifyTicket(await authSecret(env), token);
  if (!ticket) return json({ error: "تذكرة الرفع غير صالحة أو انتهت. أعد المحاولة." }, 401);

  const size = Number(req.headers.get("content-length"));
  /**
   * الطولُ يُشترط مطابقاً للتذكرة: هي وحدها مرّت على الحدّ والتحقق، فلا يُرفع
   * تحتها ما هو أكبر. و`FixedLengthStream` يقطع التيّار عند الطول المعلن، فلا
   * يزيد المرفوعُ على ما أُذن فيه ولو كذب الرأس.
   */
  if (!req.body || !Number.isFinite(size) || size !== ticket.size) {
    return json({ error: "حجم الملف لا يطابق تذكرة الرفع." }, 400);
  }

  try {
    await env.FILES.put(ticket.key, req.body.pipeThrough(new FixedLengthStream(size)), {
      httpMetadata: { contentType: ticket.contentType },
    });
  } catch (e: unknown) {
    log("upload.failed", { key: ticket.key, reason: String((e as Error)?.message ?? e) });
    return json({ error: "تعذّر حفظ الملف. أعد المحاولة." }, 502);
  }

  /**
   * والختمُ في Next: جسمُه سطرٌ من JSON فلا يضرّ تجميعُه، فيبقى إنشاء الصفوف
   * بـPrisma في موضعه الواحد. وتُمرَّر الكعكة فيستوثق من صاحب الجلسة كما لو
   * جاءه الطلب من المتصفح رأساً.
   */
  const commit = new Request(`${url.origin}/api/upload/commit`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: req.headers.get("cookie") ?? "" },
    body: JSON.stringify({ ticket: token }),
  });
  return nextApp.fetch(commit, env, ctx);
}

export default {
  /**
   * تُكتب دالّةً لا `fetch: nextApp.fetch`: المرجع المنفصل يفقد `this`، فيعمل
   * اليوم لأن OpenNext لا يستعمله، وتكسره ترقيةٌ صغرى بلا إنذار — وكلُّ طلبٍ
   * حينها 1101. والتغليف يكلّف إطار نداءٍ واحداً ويجعل العقد صريحاً.
   */
  async fetch(req: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    // القراءةُ لا تُفتَّش: `new URL` لكل طلبٍ ثمنٌ بلا مقابل، والرفعُ POST وحده
    if (req.method === "POST") {
      const url = new URL(req.url);
      if (url.pathname === "/api/upload/stream") return streamUpload(req, env, ctx, url);
    }
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
