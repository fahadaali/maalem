"use client";

import { useEffect } from "react";
import { isStaleAssetError, recover, resetRecovery } from "@/lib/client-errors";

/**
 * يلتقط أخطاء الأصول القديمة التي تقع خارج شجرة React — كفشل جلب رقعة عند
 * التنقل أو الجلب المسبق — فلا تصل إلى شاشة تعطّل أصلاً، بل يُبدأ التعافي.
 */
export default function StaleAssetGuard() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isStaleAssetError(e.error ?? e.message)) recover();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleAssetError(e.reason)) recover();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    // صفحة صمدت عشر ثوانٍ: التعافي نجح، فيُصفَّر العدّ كي تبدأ أي مشكلة لاحقة من أوله
    const settled = window.setTimeout(resetRecovery, 10_000);
    return () => {
      window.clearTimeout(settled);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
