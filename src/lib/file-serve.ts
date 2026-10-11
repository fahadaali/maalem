/**
 * تقديمُ المرفقات من R2 في غلاف العامل، قبل Next.
 *
 * ولمَ قبله؟ لأن محوّل OpenNext يكتب الردَّ في تيّارٍ بلا ضغطٍ عكسي: كلُّ قطعةٍ
 * تصل من R2 تُدفع إلى الطابور فوراً (`controller.enqueue` ثم النداءُ الراجع بلا
 * انتظار)، والمتصفحُ يسحب على قدر شبكته. فيتكدّس الملفُ كلُّه في ذاكرة النسخة
 * العاملة — وحدُّها مئةٌ وثمانٍ وعشرون ميغابايت **في الخطة المدفوعة أيضاً** —
 * وصفحةُ المكتبة ترسم غلافَ كل PDF بتنزيله كاملاً، فبضعُ كتبٍ معاً تُسقط النسخةَ
 * بـ1102، ومعها كلُّ طلبٍ آخر كان يجري عليها في تلك اللحظة.
 *
 * فصار الحكمُ في Next — بهذا الرأس يُسأل عنه وحده — والبايتاتُ من R2 إلى
 * المتصفح مباشرةً بضغطٍ عكسيٍّ تامّ، وبمدىً جزئي: PDF.js يجلب ما يعرضه من
 * الصفحات لا الملفَّ كلَّه، والصوتُ والمرئيُّ يُقدَّمان ويؤخَّران.
 *
 * ووحدةٌ نقيّة بلا استيراد عمداً: تُستورد في الحزمتين معاً.
 */

/** رأسُ سؤال الحكم: يُجيب معه مسارُ الملفات ببيانات الملف بدل بايتاته */
export const FILES_META_HEADER = "x-maalem-files-meta";

/** ما يعود من سؤال الحكم */
export type FileMeta = { key: string; name: string; contentType: string; size: number };

export type ByteRange =
  | { kind: "full" }
  | { kind: "part"; offset: number; length: number }
  | { kind: "unsatisfiable" };

/**
 * يقرأ رأس `Range` لمدىً واحد: `bytes=a-b` و`bytes=a-` و`bytes=-n`.
 *
 * وما سوى ذلك — مدياتٌ متعددة أو صيغةٌ مجهولة — يُقدَّم الملفُ معه كاملاً، كما
 * يُجيز المعيار: أن يُتجاهل الرأس خيرٌ من ردٍّ متعدد الأجزاء لا يطلبه أحدٌ هنا.
 */
export function parseRange(header: string | null, size: number): ByteRange {
  if (!header) return { kind: "full" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return { kind: "full" };
  let start: number;
  let end: number;
  if (m[1] === "") {
    const n = Number(m[2]);
    if (n === 0) return { kind: "unsatisfiable" };
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
    return { kind: "unsatisfiable" };
  }
  return { kind: "part", offset: start, length: end - start + 1 };
}

/** مُصادِقُ التخزين المؤقّت: المفتاحُ نفسه، فبايتاتُه لا تتبدّل أبداً (`safeKey`) */
export const etagOf = (key: string): string => `"${key}"`;

/** رؤوسُ الردّ المشتركة بين الكامل والجزئي و304 */
export function fileHeaders(meta: FileMeta, download: boolean): Headers {
  return new Headers({
    "Content-Type": meta.contentType || "application/octet-stream",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
    ETag: etagOf(meta.key),
    "Cache-Control": "private, max-age=0, must-revalidate",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });
}
