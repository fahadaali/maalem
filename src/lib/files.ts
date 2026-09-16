/**
 * حدود المرفقات وأنواعها — بلا أي اعتماد على بيئة الخادم، فيستوردها مكوّن
 * العميل كما يستوردها مُعالِج المسار، فيصدر الطرفان عن قاعدةٍ واحدة.
 *
 * فُصلت عن `storage.ts` لأنه يستورد `fs` و`path` و`@opennextjs/cloudflare`،
 * فاستيراده من المتصفح يكسر الحزمة.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 ميغابايت

export const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "video/mp4",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

/** ما يرشّحه منتقي الملفات. تلميحٌ لا شرط: يُتجاوز بالسحب وبتغيير الامتداد، والفحص بعده */
export const FILE_ACCEPT = ".pdf,.doc,.docx,.pptx,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.mp4";

/** حجمٌ مقروء: «1.4 م.ب» أو «320 ك.ب» */
export function fileSize(n: number): string {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} م.ب` : `${Math.ceil(n / 1024)} ك.ب`;
}

/**
 * فحصٌ في المتصفح بقواعد الخادم نفسها، قبل إنفاق ثانية واحدة في الرفع.
 *
 * ولا يُغني عنه فحص الخادم: ملفٌ مرفوض كان يُرفع كاملاً ثم يُردّ، وأسوأ منه أنّ
 * تجاوز الحدّ في إجراء خادم يقتل الطلب بردٍّ لا يفهمه العميل — فيبقى الزرّ
 * دائراً أبداً بلا رسالة.
 *
 * يعيد نصّ الخطأ، أو null إن كان الملف مقبولاً.
 */
export function checkFile(f: File): string | null {
  if (f.size === 0) return "الملف فارغ.";
  if (f.size > MAX_FILE_BYTES) {
    return `حجم الملف ${fileSize(f.size)}، والحدّ المسموح ${fileSize(MAX_FILE_BYTES)}.`;
  }
  // الخادم يعامل النوع المجهول معاملة octet-stream ويردّه، فيُطابَق هنا حرفاً بحرف
  if (!ALLOWED_TYPES.has(f.type || "application/octet-stream")) {
    return "نوع الملف غير مسموح. المسموح: مستندات وصور وصوت وفيديو.";
  }
  return null;
}

/**
 * إصدار حزمة PDF.js — يدخل في مسار موارد التصيير (`/pdf/<version>/…`) التي ينسخها
 * scripts/copy-pdf-worker.mjs، فيتغيّر المسار بترقية الحزمة ويسقط تخزينُ القديم من نفسه.
 * ثابتٌ هنا لا يُقرأ من package.json: هذا الملف يُبنى في حزمة المتصفح.
 */
export const PDFJS_VERSION = "6.3.289";
