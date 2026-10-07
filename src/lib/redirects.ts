import { redirect } from "next/navigation";

/**
 * عودةٌ برسالة نجاح أو خطأ في معاملات الرابط (`?ok=` / `?err=`).
 *
 * والمعامل يُدرج قبل المرساة لا بعدها: الوجهة «…?tab=work#i-…» تعيد المدير إلى
 * العنصر نفسه في ملف المشارك، ورسالةٌ تُلصق بعد `#` تصير جزءاً من المرساة فلا
 * تُقرأ — فيبدو الإجراء كأنه لم يحدث.
 */
export function withMessage(path: string, key: "ok" | "err", msg: string): string {
  const hash = path.indexOf("#");
  const base = hash >= 0 ? path.slice(0, hash) : path;
  const tail = hash >= 0 ? path.slice(hash) : "";
  return `${base}${base.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}${tail}`;
}

export function ok(path: string, msg: string): never {
  redirect(withMessage(path, "ok", msg));
}

export function fail(path: string, msg: string): never {
  redirect(withMessage(path, "err", msg));
}

/** وجهة العودة من حقل مخفي: تُقبل داخل مناطق المنصة فقط، لا رابطاً خارجياً */
export function safeBack(raw: string, fallback: string): string {
  return /^\/(admin|mentor|app)(\/|\?|#|$)/.test(raw) ? raw : fallback;
}
