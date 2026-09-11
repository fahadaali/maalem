/**
 * أخطاء «الأصول القديمة»: الصفحة المفتوحة تعمل على إصدار سابق، ثم تطلب رقعة
 * جافاسكربت لم تكن قد حُمِّلت، وقد زالت من الخادم بعد نشر إصدار جديد.
 * علاجها إعادة تحميل الصفحة مرة واحدة، لا شاشة خطأ.
 */
const STALE = /ChunkLoadError|Loading chunk .* failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function isStaleAssetError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; message?: string };
  return e.name === "ChunkLoadError" || STALE.test(String(e.message ?? error));
}

const GUARD = "maalem-reloaded-at";

/**
 * إعادة تحميل واحدة خلال نصف دقيقة، فلا تدخل الصفحة في حلقة إعادة تحميل
 * إن كان الخطأ غير قابل للإصلاح بالتحميل.
 */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(GUARD) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(GUARD, String(Date.now()));
  } catch {
    // لا تخزين متاح: تُسمح محاولة واحدة على أي حال
  }
  window.location.reload();
  return true;
}
