"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * يسجّل عامل الخدمة، ويراقب وصول إصدار جديد من التطبيق.
 * عند توفر تحديث يظهر شريط داخل التطبيق؛ وبالضغط عليه يُفعَّل الإصدار الجديد
 * ويُحذف مخزون الإصدار السابق كاملاً ثم تُعاد الصفحة — تحديث شامل لا جزئي.
 */
export default function PwaRegistrar() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const reloading = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => {
        reg = r;
        if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
        r.addEventListener("updatefound", () => {
          const next = r.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            // إصدار جديد جاهز، وهناك إصدار يعمل حالياً => تحديث متاح
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(next);
              setDismissed(false);
            }
          });
        });
      })
      .catch(() => {});

    // فحص دوري وعند العودة إلى التطبيق، فالتطبيق المثبّت قد يبقى مفتوحاً أياماً
    const check = () => reg?.update().catch(() => {});
    const onVisible = () => document.visibilityState === "visible" && check();
    const timer = window.setInterval(check, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!waiting) return;
    setUpdating(true);
    // حذف كل المخزون قبل التبديل، ليأتي كل شيء من الإصدار الجديد
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
    waiting.postMessage({ type: "SKIP_WAITING" });
    // احتياط لو لم يصل حدث تبديل المتحكم
    window.setTimeout(() => {
      if (!reloading.current) {
        reloading.current = true;
        window.location.reload();
      }
    }, 3000);
  }, [waiting]);

  if (!waiting || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 p-3 no-print"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="mx-auto max-w-md card border-ink flex items-center gap-3 shadow-lg">
        <RefreshCw size={18} className={updating ? "animate-spin shrink-0" : "shrink-0"} />
        <div className="flex-1 text-sm">
          <div className="font-medium">يتوفر إصدار جديد من التطبيق</div>
          <div className="text-muted text-xs">سيُحدَّث التطبيق بالكامل ويُعاد تحميله.</div>
        </div>
        <button className="btn btn-sm shrink-0" onClick={applyUpdate} disabled={updating}>
          {updating ? "جارٍ التحديث…" : "تحديث الآن"}
        </button>
        <button className="btn btn-ghost btn-sm shrink-0" onClick={() => setDismissed(true)} aria-label="لاحقاً">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
