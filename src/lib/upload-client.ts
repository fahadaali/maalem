"use client";
import type { AttachmentItem } from "@/components/Attachments";

/** مهلةٌ تسع 25 ميغابايت على شبكة جوال بطيئة، وتقطع ما جمد فلا ينتظر المستخدم أبداً */
const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * رفع مرفق إلى ‎/api/upload — مُعالِج مسار، لا إجراء خادم.
 *
 * والفرق ليس أسلوبياً: إجراءات الخادم وحدها تخضع لحدّ حجم الجسم في Next،
 * وتجاوزه يردّ 500 لا يستطيع عميل React تفسيره، فيبقى النموذج معلَّقاً بلا
 * رسالة. ومُعالِج المسار بلا حدّ، وهو المسار الذي حمل ملفات المكتبة فعلاً.
 *
 * ويُستعمل XHR لا fetch لأجل `upload.onprogress` وحده: fetch لا يعطي تقدّم
 * الرفع، وملفٌ من عشرين ميغابايت بلا نسبةٍ ظاهرة لا يُفرَّق عن التعليق.
 */
export function uploadFile(
  file: File,
  kind: string,
  refId?: string,
  onProgress?: (pct: number) => void,
): Promise<AttachmentItem> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    if (refId) fd.append("refId", refId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
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
    xhr.send(fd);
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
