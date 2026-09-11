"use client";

import { useEffect } from "react";

/**
 * يضع عدد الإشعارات غير المقروءة على أيقونة التطبيق في الشاشة الرئيسة.
 *
 * المصدر هنا هو العدد المحسوب في الخادم مع كل صفحة، فيصحّ الرقم كلما فُتح
 * التطبيق ويزول متى قُرئت الإشعارات. وأما والتطبيق مغلق فيضعه عامل الخدمة عند
 * وصول إشعار الدفع. تدعمه iOS منذ 16.4 للتطبيقات المثبَّتة على الشاشة الرئيسة.
 */
export default function AppBadge({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (nav.setAppBadge) {
      const p = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.();
      p?.catch(() => {});
      return;
    }
    // بعض الأنظمة لا تتيحها للصفحة وتتيحها لعامل الخدمة
    navigator.serviceWorker?.ready
      .then((reg) => reg.active?.postMessage({ type: "SET_BADGE", count }))
      .catch(() => {});
  }, [count]);
  return null;
}
