/**
 * أخطاء «الأصول القديمة»: الصفحة المفتوحة تعمل على إصدار سابق، ثم تطلب رقعة
 * جافاسكربت لم تكن قد حُمِّلت، وقد زالت من الخادم بعد نشر إصدار جديد.
 * علاجها إعادة تحميل الصفحة، لا شاشة خطأ.
 */
const STALE = /ChunkLoadError|Loading chunk .* failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function isStaleAssetError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; message?: string };
  return e.name === "ChunkLoadError" || STALE.test(String(e.message ?? error));
}

const GUARD = "maalem-recovery";
const WINDOW_MS = 5 * 60_000;

type Attempts = { at: number; n: number };

function read(): Attempts {
  try {
    const raw = sessionStorage.getItem(GUARD);
    const v = raw ? (JSON.parse(raw) as Attempts) : null;
    if (v && Date.now() - v.at < WINDOW_MS) return v;
  } catch {
    // لا تخزين متاح
  }
  return { at: Date.now(), n: 0 };
}

function bump(n: number) {
  try {
    sessionStorage.setItem(GUARD, JSON.stringify({ at: Date.now(), n }));
  } catch {
    // لا تخزين متاح: تمضي المحاولة دون عدّ
  }
}

/**
 * يمسح مخزون عامل الخدمة كله ويطلب منه التحقق من إصدار جديد.
 * لا يُلغى تسجيل العامل نفسه كي لا يفقد الجهاز اشتراك إشعارات الدفع.
 */
export async function clearAppCaches(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // المخزون غير متاح
  }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.update().catch(() => {})));
  } catch {
    // عامل الخدمة غير متاح
  }
}

/** إعادة تحميل تتجاوز مخزون المتصفح */
function reloadFresh() {
  const u = new URL(window.location.href);
  u.searchParams.set("_r", Date.now().toString(36));
  window.location.replace(u.toString());
}

/**
 * التعافي المتدرّج من أخطاء الأصول القديمة:
 * أولاً إعادة تحميل، فإن تكرّر العطل مُسح المخزون كله ثم أُعيد التحميل،
 * فإن تكرّر بعدها تُترك الشاشة للمستخدم فلا تدخل في حلقة لا تنتهي.
 * يردّ "reload" أو "repair" إن بوشر التعافي، و"give-up" إن استُنفدت المحاولات.
 */
export function recover(): "reload" | "repair" | "give-up" {
  const { n } = read();
  if (n === 0) {
    bump(1);
    window.location.reload();
    return "reload";
  }
  if (n === 1) {
    bump(2);
    void clearAppCaches().then(reloadFresh);
    return "repair";
  }
  return "give-up";
}

/** تصفير العدّ بعد أن تستقر صفحة، فتبدأ أي مشكلة لاحقة من أول درجات التعافي */
export function resetRecovery() {
  try {
    sessionStorage.removeItem(GUARD);
  } catch {
    // لا تخزين متاح
  }
}

/** إصلاح عميق بطلب المستخدم: يمسح المخزون ويعيد التحميل، ويصفّر العدّ */
export async function repairNow(): Promise<void> {
  bump(0);
  await clearAppCaches();
  reloadFresh();
}

/** تفصيل تقني مختصر يُعرض للمستخدم لينقله عند طلب الدعم */
export function errorDetail(error: { name?: string; message?: string; digest?: string }): string {
  const parts = [error?.name && error.name !== "Error" ? error.name : "", error?.message ?? "", error?.digest ? `#${error.digest}` : ""];
  return parts.filter(Boolean).join(" — ").slice(0, 300) || "عطل غير معروف";
}
