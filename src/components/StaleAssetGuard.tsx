"use client";

import { useEffect } from "react";
import { isStaleAssetError, reloadOnce } from "@/lib/client-errors";

/**
 * يلتقط أخطاء الأصول القديمة التي تقع خارج شجرة React — كفشل جلب رقعة عند
 * التنقل أو الجلب المسبق — فلا تصل إلى شاشة تعطّل أصلاً، بل يُعاد التحميل مرة.
 */
export default function StaleAssetGuard() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isStaleAssetError(e.error ?? e.message)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleAssetError(e.reason)) reloadOnce();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
