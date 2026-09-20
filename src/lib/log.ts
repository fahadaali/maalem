/**
 * سطرٌ واحد بصيغة JSON لكل حدث تشغيلي، تفهرسه Cloudflare Observability (وهي
 * مفعّلة في `wrangler.jsonc`) فيُبحث فيه بالحقل لا بالنصّ: `evt = "boot.refuse"`.
 *
 * وأهمُّ حقلٍ فيه `isolate`: بعد النشر، `boot.done` بمعرّفاتٍ **متعددة** صحّةٌ —
 * كلُّ نسخةٍ عاملةٍ أقلعت مرة؛ ومعرّفٌ **واحد مكرَّر** عاصفةُ إقلاعٍ تُعيد المحاولة.
 */

let isolate = "";

/**
 * معرّف النسخة العاملة: كسولٌ عمداً.
 *
 * فWorkers يمنع توليد القيم العشوائية في النطاق العام — «Disallowed operation
 * called within global scope» — فتوليده عند تحميل الوحدة يرمي في كل طلب، وهو
 * عينُ العطل الذي جاء هذا الملف ليكشفه.
 */
export function isolateId(): string {
  if (!isolate) {
    try {
      isolate = crypto.randomUUID().slice(0, 8);
    } catch {
      isolate = "unknown";
    }
  }
  return isolate;
}

/** أول أربعة إطارات من الكومة: تكفي لتحديد الموضع بلا إغراق السجل */
export function frames(e: unknown, n = 4): string {
  const stack = (e as Error)?.stack;
  if (!stack) return "";
  return stack.split("\n").slice(1, n + 1).map((s) => s.trim()).join(" | ");
}

/** نصُّ الخطأ مهما كان شكل المرميّ */
export function reason(e: unknown): string {
  return String((e as Error)?.message ?? e);
}

function line(evt: string, data: Record<string, unknown>): string {
  return JSON.stringify({ app: "maalem", evt, isolate: isolateId(), ...data });
}

/** حدثٌ عاديّ. لا إدخال/إخراج فيه، فيصلح في أي سياق — طلباً كان أو جدولة */
export function log(evt: string, data: Record<string, unknown> = {}): void {
  console.log(line(evt, data));
}

/** عطلٌ يُرشَّح وحده في اللوحة: المستوى `error` لا النصّ */
export function logError(evt: string, data: Record<string, unknown> = {}): void {
  console.error(line(evt, data));
}
