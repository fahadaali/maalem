"use client";
import type { AttachmentItem } from "@/components/Attachments";
import { MAX_FILE_BYTES } from "@/lib/files";

/**
 * مهلةٌ تسع الحدَّ الأقصى على شبكة جوال بطيئة، وتقطع ما جمد فلا ينتظر المستخدم
 * أبداً. وهي سقفٌ لا انتظار: لا تقع إلا إذا توقف الرفع فعلاً، والنسبةُ ظاهرةٌ
 * للمستخدم طوالها.
 *
 * وحسابُها من الحدّ لا رقماً مكتوباً: خمسُ دقائق كانت تسع خمسةً وعشرين ميغابايت
 * عند نحو 85 ك.ب/ث — وهي أبطأ ما يُحتمل — فرفعُ الحدّ بلا رفعها يقطع الرفع
 * الطويل في منتصفه على تلك الشبكة نفسها.
 */
const SLOWEST_BYTES_PER_SEC = 85 * 1024;
const TIMEOUT_MS = Math.ceil(MAX_FILE_BYTES / SLOWEST_BYTES_PER_SEC) * 1000;

/**
 * رفعُ مرفقٍ في خطوتين: وصفُ الملف أولاً إلى ‎/api/upload/ticket فتعود تذكرةٌ
 * موقّعة، ثم بايتاتُه إلى ‎/api/upload/stream حاملةً التذكرة.
 *
 * ولمَ خطوتان؟ لأن محوّل OpenNext يقرأ جسم كلِّ طلبٍ غير GET كاملاً في الذاكرة
 * قبل أن يبلغ Next، ثم `formData()` تفكّه فتصير نسختين، وحدُّ النسخة العاملة
 * مئةٌ وثمانٍ وعشرون ميغابايت — فملفُ الخمسين كان يسقط بـ1102. فصار طريقُ
 * البايتات يُعترض في غلاف العامل قبل Next ويمرّ تيّاراً إلى R2، والخطوةُ
 * الأولى — وجسمُها سطورٌ — هي التي تحمل الاستيثاق والتحقق.
 *
 * والمناداةُ كما كانت: خطوةٌ واحدة يراها المستورِد، والنسبةُ تتقدّم على رفع
 * البايتات وحده.
 *
 * ويُستعمل XHR لا fetch لأجل `upload.onprogress` وحده: fetch لا يعطي تقدّم
 * الرفع، وملفٌ من عشرين ميغابايت بلا نسبةٍ ظاهرة لا يُفرَّق عن التعليق.
 */
export async function uploadFile(
  file: File,
  kind: string,
  refId?: string,
  onProgress?: (pct: number) => void,
): Promise<AttachmentItem> {
  const ticket = await requestTicket(file, kind, refId);
  return sendBytes(file, ticket, onProgress);
}

/** الخطوة الأولى: وصفُ الملف يُستوثق ويُتحقّق منه، فتعود تذكرةٌ موقّعة */
async function requestTicket(file: File, kind: string, refId?: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/upload/ticket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
        kind,
        refId: refId ?? null,
      }),
    });
  } catch {
    throw new Error("انقطع الاتصال أثناء الرفع. تحقّق من الشبكة وأعد المحاولة.");
  }
  const data = (await res.json().catch(() => null)) as { ticket?: string; error?: string } | null;
  if (!res.ok || !data?.ticket) throw new Error(data?.error || statusMessage(res.status));
  return data.ticket;
}

/** الخطوة الثانية: البايتات وحدها، والردُّ هو صفُّ المرفق بعد ختمه */
function sendBytes(file: File, ticket: string, onProgress?: (pct: number) => void): Promise<AttachmentItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload/stream?ticket=${encodeURIComponent(ticket)}`);
    xhr.timeout = TIMEOUT_MS;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      /**
       * الردّ لا يكون JSON دائماً: خطأٌ من حافة Cloudflare يعود صفحة HTML،
       * و`res.json()` عليها كان يرمي رسالة إنجليزية مبهمة بدل سبب الرفض.
       */
      let data: { error?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data) return resolve(data as unknown as AttachmentItem);
      reject(new Error(data?.error || statusMessage(xhr.status)));
    };
    xhr.onerror = () => reject(new Error("انقطع الاتصال أثناء الرفع. تحقّق من الشبكة وأعد المحاولة."));
    xhr.ontimeout = () => reject(new Error("طال الرفع فوق المهلة. جرّب شبكةً أسرع أو ملفاً أصغر."));
    xhr.onabort = () => reject(new Error("أُلغي الرفع."));
    // الملفُ جسمَ الطلب كما هو: `FormData` تغلّفه بحدودٍ يفكّها الخادم، وهذا ما كان يُجمَع
    xhr.send(file);
  });
}

/** رسالةٌ عربية لكل ردٍّ لم يحمل سببه بنفسه */
function statusMessage(status: number): string {
  if (status === 0) return "تعذّر الوصول إلى الخادم.";
  if (status === 401) return "انتهت الجلسة. أعد تسجيل الدخول ثم حاول مجدداً.";
  if (status === 403) return "ليست لك صلاحية رفع هذا الملف.";
  if (status === 413) return "حجم الملف يتجاوز الحدّ المسموح.";
  if (status === 415) return "نوع الملف غير مسموح.";
  return `تعذّر الرفع (${status}).`;
}
