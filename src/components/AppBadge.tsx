"use client";

import { useEffect } from "react";

/**
 * يضع عدد الإشعارات غير المقروءة على أيقونة التطبيق في الشاشة الرئيسة.
 *
 * المصدر هنا هو العدد المحسوب في الخادم مع كل صفحة، فيصحّ الرقم كلما فُتح
 * التطبيق ويزول متى قُرئت الإشعارات. وأما والتطبيق مغلق فيضعه عامل الخدمة عند
 * وصول إشعار الدفع.
 *
 * تدعمه iOS منذ 16.4 للتطبيقات المثبَّتة على الشاشة الرئيسة، ومتصفحات سطح
 * المكتب. ولا يدعمه أندرويد فيمضي بلا أثر — ويظهر هناك مؤشر على الأيقونة من
 * النظام نفسه عند وصول الإشعار.
 */
export default function AppBadge({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge !== "function") return;
    const p = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.();
    p?.catch(() => {});
  }, [count]);
  return null;
}
